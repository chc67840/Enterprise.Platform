using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Infrastructure.MultiTenancy;

/// <summary>
/// <b>Placeholder.</b> One database per tenant. Strongest isolation + compliance
/// story; most expensive to operate. Expected behaviour: look up the tenant's logical
/// connection name in <c>DatabaseSettings</c> and route via <c>IDbContextFactory</c>
/// on every request. Requires an out-of-band tenant-to-connection registry that
/// isn't built yet.
/// </summary>
public sealed class TenantDatabaseStrategy : ITenantIsolationStrategy
{
    /// <inheritdoc />
    public TenantIsolationMode Mode => TenantIsolationMode.DatabasePerTenant;

    /// <inheritdoc />
    public Task ApplyAsync(Guid? tenantId, CancellationToken cancellationToken = default)
    {
        // Placeholder — activates when database-per-tenant deployments come online.
        // Runtime behaviour will look roughly like:
        //   1. Resolve tenant → logical DB name via a registry
        //   2. Swap the resolved `IDbContextFactory` binding for the request scope
        //   3. Warm-pool and connection-per-tenant metrics for observability.
        throw new NotSupportedException(
            "DatabasePerTenant isolation is not wired yet. Switch to SharedDatabase mode or implement this strategy.");
    }
}
