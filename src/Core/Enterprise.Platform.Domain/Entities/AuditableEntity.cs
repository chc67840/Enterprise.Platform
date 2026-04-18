using Enterprise.Platform.Domain.Interfaces;

namespace Enterprise.Platform.Domain.Entities;

/// <summary>
/// Base class for entities that participate in the audit trail. Fields are
/// populated by <c>AuditableEntityInterceptor</c> — handlers must never assign them
/// directly. Every non-reference-data domain entity should inherit from this (or from
/// <see cref="TenantAuditableEntity"/> when tenant-scoped).
/// </summary>
public abstract class AuditableEntity : BaseEntity, IAuditableEntity
{
    /// <inheritdoc />
    public string CreatedBy { get; set; } = string.Empty;

    /// <inheritdoc />
    public DateTimeOffset CreatedAt { get; set; }

    /// <inheritdoc />
    public string? ModifiedBy { get; set; }

    /// <inheritdoc />
    public DateTimeOffset? ModifiedAt { get; set; }
}
