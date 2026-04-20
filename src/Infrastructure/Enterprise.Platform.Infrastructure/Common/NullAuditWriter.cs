using Enterprise.Platform.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Placeholder <see cref="IAuditWriter"/> that logs at <see cref="LogLevel.Debug"/> but
/// never persists. Registered so the Phase-4 <c>AuditBehavior</c> can resolve its
/// dependency cleanly while PlatformDb (D4-deferred) is offline. Real
/// <c>AuditWriter</c> lands alongside the PlatformDb <c>AuditLogs</c> configuration.
/// </summary>
public sealed class NullAuditWriter(ILogger<NullAuditWriter> logger) : IAuditWriter
{
    private readonly ILogger<NullAuditWriter> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public Task WriteAsync(AuditEntry entry, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);
        _logger.AuditWriteSkipped(entry.Action, entry.RequestType);
        return Task.CompletedTask;
    }
}
