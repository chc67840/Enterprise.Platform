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

        if (_logger.IsEnabled(LogLevel.Information))
        {
#pragma warning disable CA1848
            _logger.LogInformation(
                "Integration event published: {EventType} / {MessageId} (correlation={CorrelationId}, tenant={TenantId}, attempt={AttemptCount}).",
                message.EventType,
                message.Id,
                message.CorrelationId ?? "(none)",
                message.TenantId?.ToString() ?? "(none)",
                message.AttemptCount + 1);
#pragma warning restore CA1848
        }

        return Task.CompletedTask;
    }
}
