using System.Diagnostics;
using Enterprise.Platform.Api.Common;

namespace Enterprise.Platform.Api.Middleware;

/// <summary>
/// Structured per-request logging. Emits a single info-level entry after the
/// response is built with method / path / status / elapsed, and a warning entry
/// when the status is >=400. Serilog / OTel enrichers add correlation + tenant +
/// user ids automatically when the outer middleware has pushed them.
/// </summary>
public sealed class RequestLoggingMiddleware(
    RequestDelegate next,
    ILogger<RequestLoggingMiddleware> logger)
{
    private readonly RequestDelegate _next = next ?? throw new ArgumentNullException(nameof(next));
    private readonly ILogger<RequestLoggingMiddleware> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <summary>Invokes the middleware.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var stopwatch = Stopwatch.StartNew();
        try
        {
            await _next(context).ConfigureAwait(false);
        }
        finally
        {
            stopwatch.Stop();
            LogCompleted(context, stopwatch.ElapsedMilliseconds);
        }
    }

    private void LogCompleted(HttpContext context, long elapsedMs)
    {
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? string.Empty;
        var status = context.Response.StatusCode;

        if (status >= 500)
        {
            _logger.RequestCompletedWithError(method, path, status, elapsedMs);
        }
        else if (status >= 400)
        {
            _logger.RequestCompletedWithWarning(method, path, status, elapsedMs);
        }
        else
        {
            _logger.RequestCompleted(method, path, status, elapsedMs);
        }
    }
}
