namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Contract for entities that belong to a tenant. The infrastructure applies a global
/// query filter on <see cref="TenantId"/> so cross-tenant reads are impossible by
/// accident — discipline at this marker interface is the backbone of our shared-DB
/// isolation model (see <c>TenantIsolationMode.SharedDatabase</c>).
/// </summary>
public interface ITenantEntity
{
    /// <summary>
    /// Tenant id this row belongs to. Set by the infrastructure on insert from the
    /// current request's tenant context — never assigned by application code.
    /// </summary>
    Guid TenantId { get; set; }
}
