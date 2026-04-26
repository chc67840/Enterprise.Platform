using Enterprise.Platform.Infrastructure.BackgroundJobs;
using Enterprise.Platform.Infrastructure.Messaging.IntegrationEvents;
using Enterprise.Platform.Infrastructure.Persistence.App.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Worker.Jobs;

/// <summary>
/// Drains <c>PlatformOutboxMessage</c> rows where <c>PublishedAt IS NULL</c>
/// and <c>NextAttemptAt &lt;= UtcNow</c>. Per row: invokes
/// <see cref="IIntegrationEventBroker"/>, marks <c>PublishedAt</c> on
/// success, or bumps <c>AttemptCount</c> + <c>LastError</c> + computes the next
/// exponential-backoff <c>NextAttemptAt</c> on failure. Retires messages after
/// <see cref="MaxAttempts"/> by leaving them poisoned (manual intervention).
/// </summary>
public sealed class OutboxProcessorJob : BaseBackgroundJob
{
    private const int BatchSize = 50;
    private const int MaxAttempts = 10;

    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>Initializes the job.</summary>
    public OutboxProcessorJob(IServiceScopeFactory scopeFactory, ILogger<OutboxProcessorJob> logger)
        : base(logger)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
    }

    /// <inheritdoc />
    protected override TimeSpan Interval => TimeSpan.FromSeconds(5);

    /// <inheritdoc />
    protected override async Task ExecuteCycleAsync(CancellationToken stoppingToken)
    {
        var scope = _scopeFactory.CreateAsyncScope();
        await using var scopeRegistration = scope.ConfigureAwait(false);
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var broker = scope.ServiceProvider.GetRequiredService<IIntegrationEventBroker>();

        var now = DateTimeOffset.UtcNow;
        var batch = await context.PlatformOutboxMessage
            .Where(m => m.PublishedAt == null
                && m.AttemptCount < MaxAttempts
                && m.NextAttemptAt <= now)
            .OrderBy(m => m.OccurredAt)
            .Take(BatchSize)
            .ToListAsync(stoppingToken)
            .ConfigureAwait(false);

        if (batch.Count == 0)
        {
            return;
        }

        foreach (var message in batch)
        {
            if (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                await broker.PublishAsync(message, stoppingToken).ConfigureAwait(false);
                message.PublishedAt = DateTimeOffset.UtcNow;
                message.LastError = null;
                // NextAttemptAt is non-nullable on the scaffolded entity; leave it
                // at the value it had — once PublishedAt is set, the WHERE clause
                // above won't pick the row up again.
                message.AttemptCount += 1;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message.AttemptCount += 1;
                message.LastError = ex.Message;
                message.NextAttemptAt = DateTimeOffset.UtcNow.Add(ComputeBackoff(message.AttemptCount));
#pragma warning disable CA1848
                Logger.LogWarning(
                    ex,
                    "Outbox dispatch failed for {MessageId} ({EventType}); attempt {Attempt}/{Max}, next {NextAttemptAt}.",
                    message.Id, message.EventType, message.AttemptCount, MaxAttempts, message.NextAttemptAt);
#pragma warning restore CA1848
            }
        }

        await context.SaveChangesAsync(stoppingToken).ConfigureAwait(false);
    }

    private static TimeSpan ComputeBackoff(int attempt)
    {
        // Exponential with jitter: base * 2^(attempt-1) ± 25%. Capped at 10 minutes.
        var exponent = Math.Min(attempt, 10);
        var seconds = Math.Pow(2, exponent - 1);
        var jitter = Random.Shared.NextDouble() * 0.5 - 0.25; // ±25%
        var final = Math.Min(seconds * (1 + jitter), 600);
        return TimeSpan.FromSeconds(final);
    }
}
