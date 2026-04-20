using Enterprise.Platform.Infrastructure.BackgroundJobs;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Worker.Jobs;

/// <summary>
/// <b>[–] Deferred with D4.</b> Enforces the audit-log retention policy (e.g. purge
/// rows older than 7 years / archive to cold storage). Requires the PlatformDb
/// <c>AuditLogs</c> table; placeholder until that lands.
/// </summary>
/// <remarks>
/// Expected behavior on activation:
/// <code>
/// 1. DELETE FROM AuditLogs WHERE Timestamp &lt; UtcNow - RetentionWindow;
/// 2. Optional: stream deleted rows to long-term storage (Blob / ADLS) first.
/// 3. Metric: ep.audit.retention.deleted.
/// 4. Run daily; configurable via AuditSettings.RetentionWindow.
/// </code>
/// </remarks>
public sealed class AuditRetentionJob(ILogger<AuditRetentionJob> logger) : BaseBackgroundJob(logger)
{
    /// <inheritdoc />
    protected override TimeSpan Interval => TimeSpan.FromHours(24);

    /// <inheritdoc />
    protected override Task ExecuteCycleAsync(CancellationToken stoppingToken)
    {
        // Placeholder — activates when PlatformDb + AuditLogs table land.
        return Task.CompletedTask;
    }
}
