using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Enterprise.Platform.Api.Endpoints.v1;

/// <summary>
/// Maps the three health routes — <c>/health/live</c>, <c>/health/ready</c>,
/// <c>/health/dependencies</c> — filtered by the tag registered in
/// <see cref="Configuration.HealthCheckSetup"/>. All three are anonymous so load
/// balancers and container schedulers can probe without credentials.
/// </summary>
public static class HealthEndpoints
{
    /// <summary>Wires the health routes into <paramref name="app"/>.</summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("liveness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("HealthLive");

        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("readiness"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("HealthReady");

        app.MapHealthChecks("/health/dependencies", new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("dependency"),
            ResponseWriter = WriteJsonAsync,
        }).AllowAnonymous().WithTags("Health").WithName("HealthDependencies");

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
