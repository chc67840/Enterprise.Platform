using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;
using Microsoft.Extensions.Diagnostics.HealthChecks;

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
            .AddCheck<EventShopperDbHealthCheck>(
                name: "eventshopper-db",
                failureStatus: HealthStatus.Degraded,
                tags: ["readiness", "dependency"]);

        services.AddScoped<EventShopperDbHealthCheck>();

        return services;
    }
}

/// <summary>
/// Lightweight DB health probe that avoids pulling
/// <c>Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore</c> into CPM.
/// Calls <c>Database.CanConnectAsync</c> with a short timeout.
/// </summary>
internal sealed class EventShopperDbHealthCheck(EventShopperDbContext context) : IHealthCheck
{
    private readonly EventShopperDbContext _context = context ?? throw new ArgumentNullException(nameof(context));

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);
            var ok = await _context.Database.CanConnectAsync(linked.Token).ConfigureAwait(false);
            return ok
                ? HealthCheckResult.Healthy("EventShopperDb reachable.")
                : HealthCheckResult.Degraded("EventShopperDb unreachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("EventShopperDb probe threw.", ex);
        }
    }
}
