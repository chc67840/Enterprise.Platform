using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.BackgroundJobs;

/// <summary>
/// Abstract base for hosted background jobs. Provides a cooperative cancellation loop,
/// structured logging around start/stop, and exception swallowing so a single failure
/// doesn't tear down the host. Subclasses override <see cref="ExecuteCycleAsync"/>
/// for their per-tick work and <see cref="Interval"/> for the cadence.
/// </summary>
public abstract class BaseBackgroundJob(ILogger logger) : BackgroundService
{
    /// <summary>Logger for the concrete job type; injected by derived constructors.</summary>
    protected ILogger Logger { get; } = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Human-readable job name for logs — defaults to the concrete type name.</summary>
    protected virtual string JobName => GetType().Name;

    /// <summary>Tick cadence. Jobs that are event-driven should override to <see cref="Timeout.InfiniteTimeSpan"/> and park on a signal.</summary>
    protected abstract TimeSpan Interval { get; }

    /// <summary>Work performed per tick. Must be idempotent — jobs may retry on host restart.</summary>
    protected abstract Task ExecuteCycleAsync(CancellationToken stoppingToken);

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Logger.BackgroundJobStarted(JobName);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExecuteCycleAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                Logger.BackgroundJobCycleFailed(ex, JobName, Interval);
            }

            try
            {
                await Task.Delay(Interval, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        Logger.BackgroundJobStopped(JobName);
    }
}
