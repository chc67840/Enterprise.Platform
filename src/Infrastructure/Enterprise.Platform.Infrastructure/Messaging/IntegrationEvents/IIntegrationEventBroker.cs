using Enterprise.Platform.Infrastructure.Persistence.Outbox;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Adapter that ships an already-persisted <see cref="OutboxMessage"/> to the chosen
/// broker (Azure Service Bus, RabbitMQ, Kafka, console-log in dev). The outbox
/// processor picks pending messages and calls <see cref="PublishAsync"/>; the broker
/// is responsible for durable transmission — not for ordering, not for dedupe (the
/// <see cref="OutboxMessage.Id"/> is the dedupe key).
/// </summary>
public interface IIntegrationEventBroker
{
    /// <summary>
    /// Ships <paramref name="message"/>. Should throw on transient failure so the
    /// processor can bump <c>AttemptCount</c> + back off; return normally on success.
    /// </summary>
    Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken = default);
}
