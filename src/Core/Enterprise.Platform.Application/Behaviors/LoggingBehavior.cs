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
