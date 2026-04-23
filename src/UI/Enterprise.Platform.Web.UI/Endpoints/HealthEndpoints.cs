using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Enterprise.Platform.Web.UI.Endpoints;

/// <summary>
/// Maps the host's health routes — anonymous so load-balancer and container
/// orchestrator probes don't need credentials. Mirrors the Api host's
/// convention so ops dashboards probe both surfaces with one schema.
/// </summary>
public static class HealthEndpoints
{
    /// <summary>Wires <c>/health/live</c> + <c>/health/ready</c> into <paramref name="endpoints"/>.</summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("liveness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("WebUiHealthLive");

        endpoints.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("readiness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("WebUiHealthReady");

        return endpoints;
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
