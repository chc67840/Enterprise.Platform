using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Infrastructure.MultiTenancy;

/// <summary>
/// <b>Placeholder.</b> One schema per tenant. Expected behavior: resolve the
/// tenant's schema name and apply it to the ambient <c>DbContext</c> — typically by
/// subclassing the context or switching the default schema on its model. Migrations
/// fan out per-schema at deploy time.
/// </summary>
public sealed class TenantSchemaStrategy : ITenantIsolationStrategy
{
    /// <inheritdoc />
    public TenantIsolationMode Mode => TenantIsolationMode.SchemaPerTenant;

    /// <inheritdoc />
    public Task ApplyAsync(Guid? tenantId, CancellationToken cancellationToken = default)
    {
        // Placeholder — activates when schema-per-tenant deployments come online.
        // Runtime behaviour will look roughly like:
        //   1. Resolve `$"t_{tenantId}"` → schema name
        //   2. Use a per-request DbContext configured with `modelBuilder.HasDefaultSchema(name)`
        //   3. Emit a warning when the schema doesn't exist (pre-deploy drift).
        throw new NotSupportedException(
            "SchemaPerTenant isolation is not wired yet. Switch to SharedDatabase mode or implement this strategy.");
    }
}
