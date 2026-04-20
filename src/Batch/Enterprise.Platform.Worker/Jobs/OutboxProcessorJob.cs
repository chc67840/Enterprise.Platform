using Enterprise.Platform.Infrastructure.BackgroundJobs;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Worker.Jobs;

/// <summary>
/// <b>[–] Deferred with D4.</b> Drains <c>OutboxMessages</c> into the integration-event
/// broker. Requires the PlatformDb <c>OutboxMessages</c> table — neither the table nor
/// a real <see cref="Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents.IIntegrationEventPublisher"/>
/// implementation exist yet, so registering this job would spin a loop that does
/// nothing useful. Kept as a placeholder so the file structure matches the TODO and
/// the activation is a one-registration-line change once PlatformDb is revisited.
/// </summary>
/// <remarks>
/// Expected behavior on activation:
/// <code>
/// 1. Poll OutboxMessages where PublishedAt IS NULL, ORDER BY CreatedAt, TAKE batch.
/// 2. For each: publish via IIntegrationEventPublisher (Azure Service Bus / RabbitMQ / ...)
///    inside a transaction that also flips PublishedAt on success.
/// 3. Respect exponential backoff per row; bump AttemptCount; surface poison rows after N fails.
/// 4. Metric: ep.outbox.dispatched / ep.outbox.poisoned.
/// </code>
/// </remarks>
public sealed class OutboxProcessorJob(ILogger<OutboxProcessorJob> logger) : BaseBackgroundJob(logger)
{
    /// <inheritdoc />
    protected override TimeSpan Interval => TimeSpan.FromSeconds(30);

    /// <inheritdoc />
    protected override Task ExecuteCycleAsync(CancellationToken stoppingToken)
    {
        // Placeholder — activates when PlatformDb + OutboxMessages table land.
        return Task.CompletedTask;
    }
}
