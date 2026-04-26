using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.Common;

/// <summary>
/// Source-generated <see cref="LoggerMessage"/> extensions for Infrastructure services.
/// Keeping every log call allocation-free + lazy-evaluated (CA1848 / CA1873 compliance)
/// without per-file ceremony. Event-id ranges are partitioned by subsystem to keep
/// Seq / OTel filtering clean.
/// </summary>
internal static partial class LogMessages
{
    // 2000–2099 — Identity / authorization
    [LoggerMessage(EventId = 2000, Level = LogLevel.Debug, Message = "Null audit writer invoked for {Action}/{RequestType} (PlatformDb deferred per D4).")]
    public static partial void AuditWriteSkipped(this ILogger logger, string action, string requestType);

    [LoggerMessage(EventId = 2001, Level = LogLevel.Debug, Message = "Null idempotency store miss for {Key}.")]
    public static partial void IdempotencyStoreMiss(this ILogger logger, string key);

    [LoggerMessage(EventId = 2010, Level = LogLevel.Warning, Message = "Permission check failed for principal: required '{Permission}'.")]
    public static partial void PermissionDenied(this ILogger logger, string permission);

    // 2100–2199 — Messaging / domain events
    [LoggerMessage(EventId = 2100, Level = LogLevel.Debug, Message = "Dispatching {EventType} to {HandlerCount} handler(s).")]
    public static partial void DispatchingDomainEvent(this ILogger logger, string eventType, int handlerCount);

    [LoggerMessage(EventId = 2101, Level = LogLevel.Error, Message = "Domain event handler {HandlerType} failed for {EventType}.")]
    public static partial void DomainEventHandlerFailed(this ILogger logger, Exception exception, string handlerType, string eventType);

    [LoggerMessage(EventId = 2102, Level = LogLevel.Information, Message = "Domain event handler {HandlerType} succeeded for {EventType} in {ElapsedMs} ms.")]
    public static partial void DomainEventHandlerSucceeded(this ILogger logger, string handlerType, string eventType, long elapsedMs);

    [LoggerMessage(EventId = 2103, Level = LogLevel.Error, Message = "Domain event handler {HandlerType} timed out after {TimeoutSeconds}s for {EventType} — exceeded the per-handler budget.")]
    public static partial void DomainEventHandlerTimedOut(this ILogger logger, string handlerType, double timeoutSeconds, string eventType);

    // 2200–2299 — Caching / invalidation
    [LoggerMessage(EventId = 2200, Level = LogLevel.Debug, Message = "Cache invalidation fired for keys: {Keys}.")]
    public static partial void CacheInvalidated(this ILogger logger, string keys);

    [LoggerMessage(EventId = 2201, Level = LogLevel.Information, Message = "Cache region '{Region}' invalidation requested but the active provider doesn't support prefix-scans; entries will fall out by TTL. Wire RedisCacheRegionInvalidator to make this immediate.")]
    public static partial void CacheRegionInvalidationDeferred(this ILogger logger, string region);

    // 2700–2799 — Outbox + integration events (extension to existing range)
    [LoggerMessage(EventId = 2700, Level = LogLevel.Information, Message = "Integration event published: {EventType} / {MessageId} (correlation={CorrelationId}, attempt={AttemptCount}).")]
    public static partial void IntegrationEventPublished(this ILogger logger, string eventType, Guid messageId, string correlationId, int attemptCount);

    [LoggerMessage(EventId = 2701, Level = LogLevel.Information, Message = "PlatformOutboxMessages table verified/created.")]
    public static partial void OutboxTableVerified(this ILogger logger);

    [LoggerMessage(EventId = 2702, Level = LogLevel.Error, Message = "Failed to ensure PlatformOutboxMessages table — outbox operations will fail until this is resolved.")]
    public static partial void OutboxTableEnsureFailed(this ILogger logger, Exception exception);

    // 2300–2399 — File storage / email
    [LoggerMessage(EventId = 2300, Level = LogLevel.Debug, Message = "LocalFileStorage: {Operation} {Container}/{Blob}.")]
    public static partial void LocalFileOp(this ILogger logger, string operation, string container, string blob);

    [LoggerMessage(EventId = 2301, Level = LogLevel.Warning, Message = "SMTP email deferred — no SMTP host configured.")]
    public static partial void SmtpNotConfigured(this ILogger logger);

    // 2400–2499 — Feature flags / tenants
    [LoggerMessage(EventId = 2400, Level = LogLevel.Debug, Message = "Feature flag '{Flag}' evaluated to {Enabled} (stub).")]
    public static partial void FeatureFlagEvaluated(this ILogger logger, string flag, bool enabled);

    // 2500–2599 — Background jobs
    [LoggerMessage(EventId = 2500, Level = LogLevel.Information, Message = "Background job {JobName} started.")]
    public static partial void BackgroundJobStarted(this ILogger logger, string jobName);

    [LoggerMessage(EventId = 2501, Level = LogLevel.Information, Message = "Background job {JobName} stopped.")]
    public static partial void BackgroundJobStopped(this ILogger logger, string jobName);

    [LoggerMessage(EventId = 2502, Level = LogLevel.Error, Message = "Background job {JobName} cycle failed; will retry after {Interval}.")]
    public static partial void BackgroundJobCycleFailed(this ILogger logger, Exception exception, string jobName, TimeSpan interval);

    // 2600–2699 — External services
    [LoggerMessage(EventId = 2600, Level = LogLevel.Warning, Message = "External HTTP call to {Uri} failed.")]
    public static partial void ExternalCallFailed(this ILogger logger, Exception exception, Uri? uri);

    [LoggerMessage(EventId = 2601, Level = LogLevel.Warning, Message = "External HTTP call to {Uri} timed out.")]
    public static partial void ExternalCallTimedOut(this ILogger logger, Exception exception, Uri? uri);
}
