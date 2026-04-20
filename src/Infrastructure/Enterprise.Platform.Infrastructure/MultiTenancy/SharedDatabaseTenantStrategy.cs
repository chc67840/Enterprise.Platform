using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Infrastructure.MultiTenancy;

/// <summary>
/// Single-database, row-filtered tenant isolation. The heavy lifting is done by
/// <c>TenantQueryFilterInterceptor</c> (write-side stamping) + EF global query filters
/// (read-side masking), so this strategy's <see cref="ApplyAsync"/> is a no-op — the
/// tenant context itself is already populated by <c>CurrentTenantService</c>.
/// </summary>
public sealed class SharedDatabaseTenantStrategy : ITenantIsolationStrategy
{
    /// <inheritdoc />
    public TenantIsolationMode Mode => TenantIsolationMode.SharedDatabase;

    /// <inheritdoc />
    public Task ApplyAsync(Guid? tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
