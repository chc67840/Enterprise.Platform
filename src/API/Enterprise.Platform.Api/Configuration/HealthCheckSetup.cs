using Enterprise.Platform.Contracts.Settings;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Api.Configuration;

/// <summary>
/// Registers health checks tagged by kind — <c>liveness</c> (process is up),
/// <c>readiness</c> (dependencies responsive), <c>dependency</c> (individual
/// backing services). Endpoints map per-tag routes (<c>/health/live</c>,
/// <c>/health/ready</c>, <c>/health/dependencies</c>) in <c>HealthEndpoints</c>.
/// </summary>
public static class HealthCheckSetup
{
    /// <summary>Registers the health-check services.</summary>
    public static IServiceCollection AddPlatformHealthChecks(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy("Api process is up."), tags: ["liveness"])
            .AddCheck<AppDbHealthCheck>(
                name: "app-db",
                failureStatus: HealthStatus.Degraded,
                tags: ["readiness", "dependency"])
            // P3-4 (audit) — observability pipeline probe. Tagged "observability"
            // so it surfaces in /health/dependencies but not /health/ready (a
            // dropped telemetry pipeline shouldn't fail readiness — the API still
            // serves requests; we just lose visibility).
            .AddCheck<OpenTelemetryHealthCheck>(
                name: "opentelemetry-exporter",
                failureStatus: HealthStatus.Degraded,
                tags: ["observability", "dependency"]);

        services.AddScoped<AppDbHealthCheck>();
        services.AddSingleton<OpenTelemetryHealthCheck>();

        return services;
    }
}

/// <summary>
/// Lightweight DB health probe that avoids pulling
/// <c>Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore</c> into CPM.
/// Calls <c>Database.CanConnectAsync</c> with a short timeout.
/// </summary>
internal sealed class AppDbHealthCheck(AppDbContext context) : IHealthCheck
{
    private readonly AppDbContext _context = context ?? throw new ArgumentNullException(nameof(context));

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);
            var ok = await _context.Database.CanConnectAsync(linked.Token).ConfigureAwait(false);
            return ok
                ? HealthCheckResult.Healthy("AppDb reachable.")
                : HealthCheckResult.Degraded("AppDb unreachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("AppDb probe threw.", ex);
        }
    }
}

/// <summary>
/// P3-4 (audit) — pings the configured OTLP collector endpoint via a TCP probe.
/// </summary>
/// <remarks>
/// We deliberately don't issue an OTLP-format request — that would require
/// re-implementing the OTLP protocol. A bare TCP-connect to the host:port is
/// enough to detect "collector unreachable" which is the realistic failure mode
/// (network policy, pod down, DNS hiccup). Returns <see cref="HealthStatus.Healthy"/>
/// when no <c>OtelEndpoint</c> is configured (dev / unit-test scenarios where
/// telemetry is intentionally local-only).
/// </remarks>
internal sealed class OpenTelemetryHealthCheck(IOptionsMonitor<ObservabilitySettings> settings) : IHealthCheck
{
    private readonly IOptionsMonitor<ObservabilitySettings> _settings = settings
        ?? throw new ArgumentNullException(nameof(settings));

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var endpoint = _settings.CurrentValue.OtelEndpoint;
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            return HealthCheckResult.Healthy("No OTLP endpoint configured — telemetry is local-only.");
        }

        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
        {
            return HealthCheckResult.Unhealthy($"OTLP endpoint '{endpoint}' is not a valid absolute URI.");
        }

        try
        {
            using var tcp = new System.Net.Sockets.TcpClient();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);

            await tcp.ConnectAsync(uri.Host, uri.Port, linked.Token).ConfigureAwait(false);
            return HealthCheckResult.Healthy($"OTLP endpoint {uri.Host}:{uri.Port} reachable.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Degraded($"OTLP endpoint {uri.Host}:{uri.Port} probe timed out.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded($"OTLP endpoint {uri.Host}:{uri.Port} probe failed.", ex);
        }
    }
}
