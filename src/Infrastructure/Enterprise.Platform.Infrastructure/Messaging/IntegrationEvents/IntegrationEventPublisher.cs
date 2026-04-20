using Enterprise.Platform.Domain.Events;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Contract for publishing <see cref="IIntegrationEvent"/>s to a cross-service broker
/// (Azure Service Bus, RabbitMQ, Kafka, ...). Implementations persist to the outbox
/// inside the originating transaction; a separate processor drains to the broker
/// out-of-process for at-least-once delivery.
/// </summary>
public interface IIntegrationEventPublisher
{
    /// <summary>Persists <paramref name="integrationEvent"/> to the outbox.</summary>
    Task PublishAsync(IIntegrationEvent integrationEvent, CancellationToken cancellationToken = default);
}

/// <summary>
/// <b>Placeholder.</b> Logs the event and returns — no persistence. Real outbox-backed
/// publisher lands alongside PlatformDb (D4-deferred). Kept registered so callers can
/// wire <see cref="IIntegrationEventPublisher"/> without composition-time errors.
/// </summary>
public sealed class NullIntegrationEventPublisher : IIntegrationEventPublisher
{
    /// <inheritdoc />
    public Task PublishAsync(IIntegrationEvent integrationEvent, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(integrationEvent);
        // Real implementation will write to OutboxMessages + rely on OutboxProcessor.
        return Task.CompletedTask;
    }
}
