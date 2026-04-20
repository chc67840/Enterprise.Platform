using System.Diagnostics.Metrics;

namespace Enterprise.Platform.Infrastructure.Observability;

/// <summary>
/// Central <see cref="Meter"/> + counters/histograms for domain-shaped metrics
/// (command throughput, domain events dispatched, cache hit rates, etc.). OpenTelemetry
/// observes this meter via <c>metrics.AddMeter(BusinessMetrics.MeterName)</c>.
/// </summary>
public static class BusinessMetrics
{
    /// <summary>Meter name — include in OTEL registrations.</summary>
    public const string MeterName = "Enterprise.Platform";

    /// <summary>Shared <see cref="Meter"/>; dispose at host shutdown (automatic via <c>AddOpenTelemetry</c>).</summary>
    public static readonly Meter Meter = new(MeterName, version: "1.0.0");

    /// <summary>Command executions — tagged by command name.</summary>
    public static readonly Counter<long> CommandsExecuted =
        Meter.CreateCounter<long>("ep.commands.executed", unit: "count", description: "Commands dispatched through the pipeline.");

    /// <summary>Queries executed — tagged by query name.</summary>
    public static readonly Counter<long> QueriesExecuted =
        Meter.CreateCounter<long>("ep.queries.executed", unit: "count", description: "Queries dispatched through the pipeline.");

    /// <summary>Handler elapsed time — seconds; tagged by request name.</summary>
    public static readonly Histogram<double> HandlerDuration =
        Meter.CreateHistogram<double>("ep.handler.duration", unit: "s", description: "Elapsed time per handler execution.");

    /// <summary>Domain events dispatched — tagged by event name.</summary>
    public static readonly Counter<long> DomainEventsDispatched =
        Meter.CreateCounter<long>("ep.domain_events.dispatched", unit: "count", description: "Domain events dispatched in-process.");

    /// <summary>Cache hits — tagged by region.</summary>
    public static readonly Counter<long> CacheHits =
        Meter.CreateCounter<long>("ep.cache.hits", unit: "count", description: "Cache hits served by the caching behavior.");

    /// <summary>Cache misses — tagged by region.</summary>
    public static readonly Counter<long> CacheMisses =
        Meter.CreateCounter<long>("ep.cache.misses", unit: "count", description: "Cache misses that resulted in a downstream call.");
}
