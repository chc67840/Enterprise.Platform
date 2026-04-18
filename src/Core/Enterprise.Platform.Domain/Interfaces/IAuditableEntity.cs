namespace Enterprise.Platform.Domain.Interfaces;

/// <summary>
/// Contract for entities that carry audit metadata. Populated automatically by
/// <c>AuditableEntityInterceptor</c> during <c>SaveChangesAsync</c> — handlers should
/// never set these fields directly. Implemented by <c>AuditableEntity</c> and
/// inherited by every domain entity that participates in the audit trail.
/// </summary>
public interface IAuditableEntity
{
    /// <summary>User id (or system principal) that created the entity.</summary>
    string CreatedBy { get; set; }

    /// <summary>UTC timestamp of creation.</summary>
    DateTimeOffset CreatedAt { get; set; }

    /// <summary>User id that last modified the entity. <c>null</c> until the first update.</summary>
    string? ModifiedBy { get; set; }

    /// <summary>UTC timestamp of the last modification. <c>null</c> until the first update.</summary>
    DateTimeOffset? ModifiedAt { get; set; }
}
