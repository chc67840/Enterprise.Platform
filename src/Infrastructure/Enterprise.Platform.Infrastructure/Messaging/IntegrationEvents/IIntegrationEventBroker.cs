using Enterprise.Platform.Infrastructure.Persistence.App.Entities;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Adapter that ships an already-persisted <see cref="PlatformOutboxMessage"/>
/// to the chosen broker (Azure Service Bus, RabbitMQ, Kafka, or the dev
/// console-log). The outbox processor picks pending rows and calls
/// <see cref="PublishAsync"/>; the broker is responsible for durable
/// transmission — not for ordering, not for dedupe (the
/// <see cref="PlatformOutboxMessage.Id"/> is the dedupe key).
/// </summary>
public interface IIntegrationEventBroker
{
    /// <summary>
    /// Ships <paramref name="message"/>. Should throw on transient failure so the
    /// processor can bump <c>AttemptCount</c> + back off; return normally on success.
    /// </summary>
    Task PublishAsync(PlatformOutboxMessage message, CancellationToken cancellationToken = default);
}
