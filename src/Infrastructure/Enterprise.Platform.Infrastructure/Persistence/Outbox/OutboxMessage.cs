namespace Enterprise.Platform.Infrastructure.Persistence.Outbox;

/// <summary>
/// Transactionally-persisted integration event. Written by
/// <c>OutboxIntegrationEventPublisher</c> inside the originating command's
/// transaction, drained asynchronously by <c>OutboxProcessorJob</c>. At-least-once
/// delivery — consumers must be idempotent. Rows are retained after
/// <see cref="PublishedAt"/> for observability until <c>AuditRetentionJob</c> (or
/// an equivalent cleanup) purges them.
/// </summary>
public sealed class OutboxMessage
{
    /// <summary>Stable event id — consumers dedupe on this value.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Versioned event type (e.g. <c>"UserRegistered.v1"</c>).</summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>Serialised event body (JSON).</summary>
    public string Payload { get; set; } = string.Empty;

    /// <summary>UTC timestamp the message was enqueued.</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>UTC timestamp of successful dispatch. <c>null</c> while pending.</summary>
    public DateTime? PublishedAt { get; set; }

    /// <summary>Attempts so far — bumped on every failure.</summary>
    public int AttemptCount { get; set; }

    /// <summary>Most recent error message when <see cref="PublishedAt"/> is <c>null</c>.</summary>
    public string? LastError { get; set; }

    /// <summary>Earliest UTC timestamp at which the next attempt is allowed (exponential backoff).</summary>
    public DateTime? NextAttemptAt { get; set; }

    /// <summary>Correlation id threaded from the originating request, when available.</summary>
    public string? CorrelationId { get; set; }
}
