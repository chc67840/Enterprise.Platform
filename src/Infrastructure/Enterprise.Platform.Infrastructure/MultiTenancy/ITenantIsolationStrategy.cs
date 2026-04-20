using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Infrastructure.MultiTenancy;

/// <summary>
/// Per-request tenant isolation contract. One implementation per
/// <see cref="TenantIsolationMode"/>; the active strategy is selected in DI based on
/// <c>MultiTenancySettings.IsolationMode</c>. Consumers call <see cref="ApplyAsync"/>
/// before a unit-of-work runs so the strategy can stamp the DbContext or swap its
/// connection.
/// </summary>
public interface ITenantIsolationStrategy
{
    /// <summary>Mode this strategy handles.</summary>
    TenantIsolationMode Mode { get; }

    /// <summary>
    /// Applies the strategy's isolation hints to the current request scope. Called by
    /// tenant-aware middleware early in the pipeline. The default no-op is sufficient
    /// for <see cref="TenantIsolationMode.SharedDatabase"/> where the write interceptor
    /// and query filter do the work.
    /// </summary>
    Task ApplyAsync(Guid? tenantId, CancellationToken cancellationToken = default);
}
