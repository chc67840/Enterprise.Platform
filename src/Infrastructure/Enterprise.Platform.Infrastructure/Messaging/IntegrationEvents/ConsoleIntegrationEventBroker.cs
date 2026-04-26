using Enterprise.Platform.Infrastructure.Common;
using Enterprise.Platform.Infrastructure.Persistence.Outbox;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;

/// <summary>
/// Dev / CI broker that logs every published message to the standard logging
/// pipeline (Serilog → Console / Seq). Never the right choice for production —
/// replace with <c>AzureServiceBusIntegrationEventBroker</c>,
/// <c>RabbitMqIntegrationEventBroker</c>, or similar when the real broker is
/// provisioned.
/// </summary>
public sealed class ConsoleIntegrationEventBroker(ILogger<ConsoleIntegrationEventBroker> logger) : IIntegrationEventBroker
{
    private readonly ILogger<ConsoleIntegrationEventBroker> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public Task PublishAsync(OutboxMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        _logger.IntegrationEventPublished(
            message.EventType,
            message.Id,
            message.CorrelationId ?? "(none)",
            message.AttemptCount + 1);

        return Task.CompletedTask;
    }
}
