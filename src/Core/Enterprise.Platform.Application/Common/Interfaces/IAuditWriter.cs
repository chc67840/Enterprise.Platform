namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Write side of the audit trail. Consumed by <c>AuditBehavior</c> after a command
/// completes (success or failure). Infrastructure implements this against the
/// <c>AuditLog</c> table on PlatformDb — until PlatformDb lands (D4), a no-op
/// implementation is registered so the pipeline stays compilable end-to-end.
/// </summary>
public interface IAuditWriter
{
    /// <summary>Persists <paramref name="entry"/>. Must not throw on transient failures — the audit path is best-effort.</summary>
    Task WriteAsync(AuditEntry entry, CancellationToken cancellationToken = default);
}

/// <summary>Structured audit-log entry produced by <c>AuditBehavior</c>.</summary>
public sealed class AuditEntry
{
    /// <summary>UTC timestamp the command was dispatched.</summary>
    public required DateTimeOffset Timestamp { get; init; }

    /// <summary>Authenticated user id, if any.</summary>
    public Guid? UserId { get; init; }

    /// <summary>Correlation id threaded through from the inbound request.</summary>
    public string? CorrelationId { get; init; }

    /// <summary>Short verb (e.g. <c>"CreateTenant"</c>). Supplied by the command via <c>IRequiresAudit.AuditAction</c>.</summary>
    public required string Action { get; init; }

    /// <summary>Subject id (e.g. affected entity). Optional.</summary>
    public string? Subject { get; init; }

    /// <summary>Concrete command type name — useful for filter-by-shape queries.</summary>
    public required string RequestType { get; init; }

    /// <summary>Serialized command payload (PII scrubbed at the writer boundary).</summary>
    public string? RequestSnapshot { get; init; }

    /// <summary><c>true</c> when the handler completed without throwing.</summary>
    public required bool Succeeded { get; init; }

    /// <summary>Failure message on the failure path. <c>null</c> on success.</summary>
    public string? FailureReason { get; init; }

    /// <summary>Elapsed milliseconds from dispatch to completion.</summary>
    public required long ElapsedMilliseconds { get; init; }
}
