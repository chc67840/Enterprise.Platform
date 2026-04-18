namespace Enterprise.Platform.Application.Abstractions.Behaviors;

/// <summary>
/// Opt-in marker for commands that must produce an audit-trail entry. <c>AuditBehavior</c>
/// captures request shape, current principal, outcome, and elapsed time, then hands the
/// record to <see cref="Common.Interfaces.IAuditWriter"/>. Sensitive fields should be
/// scrubbed before assignment — the audit payload is persisted as-is.
/// </summary>
public interface IRequiresAudit
{
    /// <summary>
    /// Short, human-readable action verb (e.g. <c>"CreateTenant"</c>,
    /// <c>"AssignRole"</c>) used as the audit entry's action column.
    /// </summary>
    string AuditAction { get; }

    /// <summary>
    /// Optional subject id (e.g. the target user's id). Lets audit queries filter by
    /// "all actions performed against this entity" without parsing the payload.
    /// </summary>
    string? AuditSubject => null;
}
