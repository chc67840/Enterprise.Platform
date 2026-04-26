using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Entities;

/// <summary>
/// Hand-authored partial for the scaffolded <see cref="PlatformOutboxMessage"/>
/// entity. Adds the static <see cref="Create"/> factory used by
/// <c>OutboxIntegrationEventPublisher</c> — kept here (not on the publisher)
/// so the dedupe-key invariant ("outbox row Id == integration-event Id when
/// the event supplies one") is enforced from inside the entity, not at every
/// call site.
/// </summary>
public partial class PlatformOutboxMessage
{
    /// <summary>
    /// Materialises a new outbox row from <paramref name="integrationEvent"/>.
    /// When the event carries a non-empty <see cref="IIntegrationEvent.EventId"/>,
    /// that value becomes the outbox row's primary key — guaranteeing that two
    /// publish attempts for the same logical event collapse to one row (the
    /// unique-PK constraint becomes the dedupe boundary).
    /// </summary>
    public static PlatformOutboxMessage Create(
        IIntegrationEvent integrationEvent,
        string serialisedPayload,
        string? correlationId,
        string? traceId)
    {
        ArgumentNullException.ThrowIfNull(integrationEvent);
        ArgumentException.ThrowIfNullOrWhiteSpace(serialisedPayload);

        var message = new PlatformOutboxMessage
        {
            EventType = integrationEvent.EventType,
            Payload = serialisedPayload,
            OccurredAt = integrationEvent.OccurredOn,
            CorrelationId = correlationId,
            TraceId = traceId,
            // AttemptCount + NextAttemptAt fall back to their SQL DEFAULTs (0 / SYSUTCDATETIME()).
        };

        if (integrationEvent.EventId != Guid.Empty)
        {
            // BaseEntity.Id has a protected setter; assignable inside the derived class.
            message.Id = integrationEvent.EventId;
        }

        return message;
    }
}
