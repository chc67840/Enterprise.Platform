using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Source-generated <see cref="LoggerMessage"/> extensions for pipeline behaviors.
/// Consolidated here so every log site in the behavior stack is strongly-typed, lazy,
/// and allocation-free — the CA1848-preferred pattern.
/// </summary>
internal static partial class LogMessages
{
    // LoggingBehavior --------------------------------------------------------
    [LoggerMessage(EventId = 1000, Level = LogLevel.Information, Message = "Handling {RequestName}")]
    public static partial void Handling(this ILogger logger, string requestName);

    [LoggerMessage(EventId = 1001, Level = LogLevel.Information, Message = "Handled {RequestName} in {ElapsedMs}ms")]
    public static partial void Handled(this ILogger logger, string requestName, long elapsedMs);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Error, Message = "Error handling {RequestName} after {ElapsedMs}ms")]
    public static partial void HandlingFailed(this ILogger logger, Exception exception, string requestName, long elapsedMs);

    // TransactionBehavior ----------------------------------------------------
    [LoggerMessage(EventId = 1100, Level = LogLevel.Error, Message = "Rollback failed for {RequestType} — the original failure still propagates.")]
    public static partial void RollbackFailed(this ILogger logger, Exception exception, string requestType);

    // AuditBehavior ----------------------------------------------------------
    [LoggerMessage(EventId = 1200, Level = LogLevel.Warning, Message = "Audit writer failed for {RequestType} — primary operation outcome is authoritative.")]
    public static partial void AuditWriteFailed(this ILogger logger, Exception exception, string requestType);

    // CachingBehavior --------------------------------------------------------
    [LoggerMessage(EventId = 1300, Level = LogLevel.Debug, Message = "Cache hit for {CacheKey}")]
    public static partial void CacheHit(this ILogger logger, string cacheKey);

    [LoggerMessage(EventId = 1301, Level = LogLevel.Warning, Message = "Discarding corrupt cache entry for {CacheKey}")]
    public static partial void CacheEntryCorrupt(this ILogger logger, Exception exception, string cacheKey);

    [LoggerMessage(EventId = 1302, Level = LogLevel.Warning, Message = "Cache write failed for {CacheKey}")]
    public static partial void CacheWriteFailed(this ILogger logger, Exception exception, string cacheKey);

    // IdempotencyBehavior ----------------------------------------------------
    [LoggerMessage(EventId = 1400, Level = LogLevel.Information, Message = "Idempotency hit for {RequestType} — skipping handler.")]
    public static partial void IdempotencyHit(this ILogger logger, string requestType);

    [LoggerMessage(EventId = 1401, Level = LogLevel.Warning, Message = "Idempotency store write failed for {RequestType}")]
    public static partial void IdempotencyWriteFailed(this ILogger logger, Exception exception, string requestType);

    // CacheInvalidationBehavior (P3-1 audit migration) -----------------------
    [LoggerMessage(EventId = 1500, Level = LogLevel.Warning, Message = "Cache invalidation failed for {CacheKey}")]
    public static partial void CacheInvalidationFailed(this ILogger logger, Exception exception, string cacheKey);

    [LoggerMessage(EventId = 1501, Level = LogLevel.Warning, Message = "Cache region invalidation failed for {Region}")]
    public static partial void CacheRegionInvalidationFailed(this ILogger logger, Exception exception, string region);
}
