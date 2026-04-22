using System.Diagnostics.Metrics;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// `System.Diagnostics.Metrics`-backed counters + histograms for the BFF
/// session lifecycle. Exposed under the meter name
/// <see cref="MeterName"/>; pick them up via OpenTelemetry's metrics
/// pipeline (already wired by <c>ObservabilitySettings</c>).
/// </summary>
/// <remarks>
/// Use a singleton: one <see cref="Meter"/> per host process is the canonical
/// pattern. Instrument types are thread-safe; callers can fire from any
/// concurrent path (token-refresh hook, cookie-events, etc.).
///
/// <para><b>Cardinality discipline.</b> Tags here stay low-cardinality (status
/// strings only — never user ids or tenant ids). High-cardinality dimensions
/// belong on traces, not metrics.</para>
/// </remarks>
public sealed class BffSessionMetrics : IDisposable
{
    /// <summary>Meter name surfaced to OpenTelemetry / dotnet-counters.</summary>
    public const string MeterName = "Enterprise.Platform.Web.UI";

    private readonly Meter _meter;

    /// <summary>Increments on every successful OIDC sign-in (cookie issued).</summary>
    public Counter<long> SessionsCreated { get; }

    /// <summary>Increments on every successful refresh-token rotation in OnValidatePrincipal.</summary>
    public Counter<long> SessionsRefreshed { get; }

    /// <summary>Increments when refresh fails — session about to be invalidated.</summary>
    public Counter<long> SessionsRefreshFailed { get; }

    /// <summary>
    /// Records the wall-clock seconds a session lived (login → logout / expiry).
    /// Useful for spotting regressions in cookie-lifetime or refresh-token TTL.
    /// </summary>
    public Histogram<double> SessionLifetimeSeconds { get; }

    /// <summary>
    /// Constructed via DI as a singleton. The IMeterFactory pattern lets
    /// tests resolve a scoped meter — preferable to `new Meter(...)`
    /// directly, which leaks across test cases.
    /// </summary>
    public BffSessionMetrics(IMeterFactory meterFactory)
    {
        ArgumentNullException.ThrowIfNull(meterFactory);

        _meter = meterFactory.Create(MeterName);

        SessionsCreated = _meter.CreateCounter<long>(
            "ep.bff.session.created",
            unit: "{session}",
            description: "BFF sessions issued (OIDC sign-in completed).");

        SessionsRefreshed = _meter.CreateCounter<long>(
            "ep.bff.session.refreshed",
            unit: "{rotation}",
            description: "Access tokens rotated via refresh_token in OnValidatePrincipal.");

        SessionsRefreshFailed = _meter.CreateCounter<long>(
            "ep.bff.session.refresh_failed",
            unit: "{failure}",
            description: "Refresh-token rotations that failed (token revoked, network, malformed payload).");

        SessionLifetimeSeconds = _meter.CreateHistogram<double>(
            "ep.bff.session.lifetime",
            unit: "s",
            description: "Wall-clock seconds a BFF session lived from sign-in to sign-out / expiry.");
    }

    /// <inheritdoc />
    public void Dispose() => _meter.Dispose();
}
