namespace Enterprise.Platform.Domain.Events;

/// <summary>
/// Marker for an event crossing a service boundary. Persisted to the outbox
/// alongside the originating transaction and delivered out-of-process by
/// <c>OutboxProcessor</c> — at-least-once delivery with idempotent consumers.
/// </summary>
public interface IIntegrationEvent
{
    /// <summary>Stable event id — consumers dedupe on this value.</summary>
    Guid EventId { get; }

    /// <summary>UTC instant the event was raised.</summary>
    DateTimeOffset OccurredOn { get; }

    /// <summary>
    /// Contract type name (e.g. <c>"UserRegistered.v1"</c>). Include the version so
    /// consumers can branch on schema evolution without parsing the payload.
    /// </summary>
    string EventType { get; }
}
