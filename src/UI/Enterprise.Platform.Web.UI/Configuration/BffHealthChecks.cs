using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Enterprise.Platform.Web.UI.Configuration;

/// <summary>
/// BFF health checks tagged by kind:
/// <list type="bullet">
///   <item><b>liveness</b> — process is up + Kestrel is serving (the
///         <c>self</c> check). Used by container orchestrators to decide
///         whether to restart the pod.</item>
///   <item><b>readiness</b> — downstream Api is reachable. Used by load
///         balancers to decide whether to route traffic.</item>
/// </list>
/// Mirror of the Api's <c>HealthCheckSetup</c> so ops dashboards can probe
/// both surfaces with the same conventions.
/// </summary>
public static class BffHealthChecks
{
    /// <summary>Named HTTP client used for the downstream Api liveness probe.</summary>
    public const string HttpClientName = "ep-bff-health";

    /// <summary>Registers BFF health-check services.</summary>
    public static IServiceCollection AddBffHealthChecks(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddHttpClient(HttpClientName);

        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy("BFF process is up."), tags: ["liveness"])
            .AddCheck<DownstreamApiHealthCheck>(
                name: "downstream-api",
                failureStatus: HealthStatus.Degraded,
                tags: ["readiness", "dependency"]);

        services.AddScoped<DownstreamApiHealthCheck>();

        return services;
    }

    /// <summary>Wires the health endpoints. Anonymous so probes don't need credentials.</summary>
    public static IEndpointRouteBuilder MapBffHealthEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("liveness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("BffHealthLive");

        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("readiness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("BffHealthReady");

        return app;
    }

    private static Task WriteJsonAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        var payload = new
        {
            status = report.Status.ToString(),
            durationMs = report.TotalDuration.TotalMilliseconds,
            entries = report.Entries.ToDictionary(
                kv => kv.Key,
                kv => new
                {
                    status = kv.Value.Status.ToString(),
                    description = kv.Value.Description,
                    durationMs = kv.Value.Duration.TotalMilliseconds,
                    tags = kv.Value.Tags,
                }),
        };
        return JsonSerializer.SerializeAsync(context.Response.Body, payload);
    }
}

/// <summary>
/// Probes the downstream Api by issuing a 3-second-timeout GET against its
/// <c>/health/live</c>. Anonymous — the Api's own health endpoints are
/// anonymous too so the probe doesn't require a token.
/// </summary>
internal sealed class DownstreamApiHealthCheck(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<BffProxySettings> settings) : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
    private readonly IOptionsMonitor<BffProxySettings> _settings = settings ?? throw new ArgumentNullException(nameof(settings));

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var apiBase = new Uri(_settings.CurrentValue.ApiBaseUri);
            // ApiBaseUri ends in `/api/`; the Api's health endpoint sits at the host root.
            var probeTarget = new Uri(apiBase, "/health/live");

            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);
            using var client = _httpClientFactory.CreateClient(BffHealthChecks.HttpClientName);
            using var response = await client.GetAsync(probeTarget, linked.Token).ConfigureAwait(false);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy($"Downstream Api reachable at {probeTarget}.")
                : HealthCheckResult.Degraded($"Downstream Api at {probeTarget} returned {(int)response.StatusCode}.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Degraded("Downstream Api probe timed out (3s).");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Downstream Api probe threw.", ex);
        }
    }
}
