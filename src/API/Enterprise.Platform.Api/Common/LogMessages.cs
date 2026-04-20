using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Api.Common;

/// <summary>
/// Source-generated <see cref="LoggerMessage"/> extensions for Api-tier log sites.
/// Event-id range <c>3000–3999</c> (Infrastructure owns <c>2000–2699</c>).
/// </summary>
internal static partial class LogMessages
{
    // 3000–3099 — Request logging
    [LoggerMessage(EventId = 3000, Level = LogLevel.Information, Message = "{Method} {Path} -> {Status} in {ElapsedMs}ms")]
    public static partial void RequestCompleted(this ILogger logger, string method, string path, int status, long elapsedMs);

    [LoggerMessage(EventId = 3001, Level = LogLevel.Warning, Message = "{Method} {Path} -> {Status} in {ElapsedMs}ms")]
    public static partial void RequestCompletedWithWarning(this ILogger logger, string method, string path, int status, long elapsedMs);

    [LoggerMessage(EventId = 3002, Level = LogLevel.Error, Message = "{Method} {Path} -> {Status} in {ElapsedMs}ms")]
    public static partial void RequestCompletedWithError(this ILogger logger, string method, string path, int status, long elapsedMs);

    // 3100–3199 — Exception mapping
    [LoggerMessage(EventId = 3100, Level = LogLevel.Error, Message = "Unhandled exception on {Path} -> {Status}.")]
    public static partial void UnhandledException(this ILogger logger, Exception exception, string path, int status);

    [LoggerMessage(EventId = 3101, Level = LogLevel.Warning, Message = "Handled exception on {Path} -> {Status}.")]
    public static partial void HandledException(this ILogger logger, Exception exception, string path, int status);

    // 3200–3299 — Endpoint filters
    [LoggerMessage(EventId = 3200, Level = LogLevel.Debug, Message = "Endpoint {Endpoint} completed in {ElapsedMs}ms.")]
    public static partial void EndpointCompleted(this ILogger logger, string endpoint, long elapsedMs);
}
