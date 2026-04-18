using Enterprise.Platform.Domain.Interfaces;

namespace Enterprise.Platform.Domain.Entities;

/// <summary>
/// Base class for tenant-scoped audit-tracked entities. The platform's primary entity
/// base in a multi-tenant system — <c>User</c>, <c>Tenant</c>, and platform
/// reference data are rare exceptions that inherit <see cref="AuditableEntity"/>
/// directly.
/// </summary>
public abstract class TenantAuditableEntity : AuditableEntity, ITenantEntity
{
    /// <inheritdoc />
    public Guid TenantId { get; set; }
}
