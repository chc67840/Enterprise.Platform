using System.Diagnostics;
using Enterprise.Platform.Api.Common;

namespace Enterprise.Platform.Api.Filters;

/// <summary>
/// Per-endpoint lightweight timing log. Complements the pipeline-wide
/// <c>RequestLoggingMiddleware</c> with an endpoint-name dimension so dashboards
/// can isolate slow endpoints without parsing request paths.
/// </summary>
public sealed class LogEndpointFilter(ILogger<LogEndpointFilter> logger) : IEndpointFilter
{
    private readonly ILogger<LogEndpointFilter> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        var stopwatch = Stopwatch.StartNew();
        try
        {
            return await next(context).ConfigureAwait(false);
        }
        finally
        {
            stopwatch.Stop();
            if (_logger.IsEnabled(LogLevel.Debug))
            {
                var endpoint = context.HttpContext.GetEndpoint()?.DisplayName ?? "unknown";
                _logger.EndpointCompleted(endpoint, stopwatch.ElapsedMilliseconds);
            }
        }
    }
}
