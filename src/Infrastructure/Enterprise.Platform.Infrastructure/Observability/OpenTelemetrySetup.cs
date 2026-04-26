using Enterprise.Platform.Contracts.Settings;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Enterprise.Platform.Infrastructure.Observability;

/// <summary>
/// Wires OpenTelemetry tracing + metrics with the OTLP exporter. Reads
/// <see cref="ObservabilitySettings"/> to populate the resource + choose sampling.
/// Hosts call this from their startup composition; a missing
/// <see cref="ObservabilitySettings.OtelEndpoint"/> disables exporting but still
/// collects spans locally (useful in dev).
/// </summary>
public static class OpenTelemetrySetup
{
    /// <summary>Adds OpenTelemetry tracing + metrics to <paramref name="services"/>.</summary>
    public static IServiceCollection AddPlatformOpenTelemetry(
        this IServiceCollection services,
        ObservabilitySettings settings)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(settings);

        var otel = services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(settings.ServiceName, serviceVersion: settings.ServiceVersion)
                .AddTelemetrySdk());

        otel.WithTracing(tracing =>
        {
            tracing.SetSampler(new TraceIdRatioBasedSampler(Math.Clamp(settings.SamplingRatio, 0d, 1d)));
            tracing.AddAspNetCoreInstrumentation();

            // P0-1 / P1-3 (audit) — domain-event handler activity source so each
            // handler invocation surfaces as a span under the originating request.
            tracing.AddSource("Enterprise.Platform.DomainEvents");

            if (settings.EnableHttpInstrumentation)
            {
                tracing.AddHttpClientInstrumentation();
            }

            if (settings.EnableDatabaseInstrumentation)
            {
                tracing.AddEntityFrameworkCoreInstrumentation();
                tracing.AddSqlClientInstrumentation();
            }

            if (!string.IsNullOrWhiteSpace(settings.OtelEndpoint))
            {
                tracing.AddOtlpExporter(opt => opt.Endpoint = new Uri(settings.OtelEndpoint));
            }
        });

        otel.WithMetrics(metrics =>
        {
            metrics.AddAspNetCoreInstrumentation();
            metrics.AddHttpClientInstrumentation();
            // Runtime instrumentation would be nice to have, but requires the separate
            // OpenTelemetry.Instrumentation.Runtime package — add to CPM + wire here
            // when we're ready to track GC / thread-pool / exceptions at the metric layer.
            metrics.AddMeter(BusinessMetrics.MeterName);

            if (!string.IsNullOrWhiteSpace(settings.OtelEndpoint))
            {
                metrics.AddOtlpExporter(opt => opt.Endpoint = new Uri(settings.OtelEndpoint));
            }
        });

        return services;
    }
}
