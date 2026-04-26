using System.Diagnostics;
using Enterprise.Platform.Application.Abstractions.Behaviors;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Application.Behaviors;

/// <summary>
/// Pipeline order 1 — outermost. Logs handler entry / exit at
/// <see cref="LogLevel.Information"/> and unhandled exceptions at
/// <see cref="LogLevel.Error"/>, enriched with elapsed milliseconds. Structured
/// logging fields: <c>RequestName</c>, <c>ElapsedMs</c>.
/// </summary>
/// <remarks>
/// <b>P2-8 audit (context enrichment):</b> the request type name is pushed into
/// the ambient <c>ILogger</c> scope via <see cref="ILogger.BeginScope"/> so every
/// nested log line under this handler carries the <c>RequestType</c> property
/// automatically — no per-handler call to <c>logger.LogX("…", requestName)</c>
/// needed. Combined with <c>CorrelationIdMiddleware</c>'s <c>CorrelationId</c>
/// property, every log line in the request scope can be filtered by either
/// dimension in Seq / OTel. <c>BeginScope</c> is framework-neutral; Serilog
/// reads the dictionary via its built-in scope reader, so no Serilog reference
/// leaks into the Application project.
/// </remarks>
public sealed class LoggingBehavior<TRequest, TResponse>(
    ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    /// <inheritdoc />
    public async Task<TResponse> HandleAsync(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(next);

        var requestName = typeof(TRequest).Name;

        // P2-8 — push the request type into the ambient log scope so every log
        // line emitted by inner behaviors / handlers / domain code under this
        // scope is enriched with `RequestType`. Disposed at end of method.
        using var requestScope = logger.BeginScope(new Dictionary<string, object>
        {
            ["RequestType"] = requestName,
        });

        var stopwatch = Stopwatch.StartNew();

        logger.Handling(requestName);
        try
        {
            var response = await next().ConfigureAwait(false);
            stopwatch.Stop();
            logger.Handled(requestName, stopwatch.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            stopwatch.Stop();
            logger.HandlingFailed(ex, requestName, stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}
