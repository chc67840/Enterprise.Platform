using Enterprise.Platform.Shared.Enumerations;

namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Ambient information about the tenant the current request is operating for. Set by
/// <c>TenantResolutionMiddleware</c> and consumed by EF query filters + audit writers.
/// </summary>
public interface ICurrentTenantService
{
    /// <summary>
    /// Resolved tenant id. <c>null</c> only on anonymous endpoints or when resolution
    /// explicitly failed and <c>MultiTenancySettings.RequireResolvedTenant</c> is <c>false</c>.
    /// </summary>
    Guid? TenantId { get; }

    /// <summary>Isolation mode configured for this deployment.</summary>
    TenantIsolationMode IsolationMode { get; }
}
