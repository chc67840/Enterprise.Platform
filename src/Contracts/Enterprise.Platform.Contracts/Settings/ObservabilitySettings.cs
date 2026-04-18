namespace Enterprise.Platform.Contracts.Settings;

/// <summary>
/// OpenTelemetry + structured-logging knobs. Bound from the <c>Observability</c>
/// section. Host startup uses these to configure the OTLP exporter, Serilog sinks, and
/// sampling.
/// </summary>
public sealed class ObservabilitySettings
{
    /// <summary>Configuration section name — <c>Observability</c>.</summary>
    public const string SectionName = "Observability";

    /// <summary>
    /// Human-readable service name reported as the OpenTelemetry <c>service.name</c>
    /// resource. Keep stable across deployments so traces correlate.
    /// </summary>
    public string ServiceName { get; set; } = "enterprise-platform";

    /// <summary>
    /// Service version — typically mirrored from <see cref="AppSettings.Version"/>.
    /// Populated by CI during build.
    /// </summary>
    public string ServiceVersion { get; set; } = "0.0.0";

    /// <summary>
    /// OTLP endpoint (e.g. <c>https://otel-collector.observability.svc:4317</c>). Empty
    /// disables the exporter — useful for pure-console dev.
    /// </summary>
    public string OtelEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// Head-based sampling rate in the inclusive range <c>[0.0, 1.0]</c>.
    /// <c>1.0</c> samples every trace (dev); production typically uses <c>0.1</c> to <c>0.2</c>.
    /// </summary>
    public double SamplingRatio { get; set; } = 1.0;

    /// <summary>Include EF Core database spans in the export — expensive; off by default.</summary>
    public bool EnableDatabaseInstrumentation { get; set; }

    /// <summary>Include outbound HTTP spans — on by default for dependency mapping.</summary>
    public bool EnableHttpInstrumentation { get; set; } = true;

    /// <summary>
    /// Seq log server endpoint (<c>https://seq.observability.svc</c>). When set, Serilog
    /// adds the Seq sink alongside the console sink.
    /// </summary>
    public string? SeqEndpoint { get; set; }
}
