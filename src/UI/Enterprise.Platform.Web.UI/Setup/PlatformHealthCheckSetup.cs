using Enterprise.Platform.Web.UI.Services.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Enterprise.Platform.Web.UI.Setup;

/// <summary>
/// Registers health-check services tagged by kind:
/// <list type="bullet">
///   <item><b>liveness</b> — process is up + Kestrel is serving (the
///         <c>self</c> check). Used by container orchestrators to decide
///         whether to restart the pod.</item>
///   <item><b>readiness</b> — downstream Api is reachable. Used by load
///         balancers to decide whether to route traffic.</item>
/// </list>
/// Endpoint mapping (the <c>/health/live</c> + <c>/health/ready</c> routes)
/// lives in <see cref="Endpoints.HealthEndpoints"/>.
/// </summary>
public static class PlatformHealthCheckSetup
{
    /// <summary>Registers health-check services.</summary>
    public static IServiceCollection AddPlatformHealthChecks(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddHttpClient(DownstreamApiHealthCheck.HttpClientName);

        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy("Web.UI process is up."), tags: ["liveness"])
            .AddCheck<DownstreamApiHealthCheck>(
                name: "downstream-api",
                failureStatus: HealthStatus.Degraded,
                tags: ["readiness", "dependency"]);

        services.AddScoped<DownstreamApiHealthCheck>();

        return services;
    }
}
