using Serilog.Context;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Api.Middleware;

/// <summary>
/// First middleware in the pipeline — stamps every request with a correlation id
/// that threads through logs, traces, and the response header. Reads an inbound
/// <c>X-Correlation-ID</c> when the caller supplied one; otherwise mints a new Guid.
/// </summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    /// <summary>HttpContext.Items key under which the correlation id is stored.</summary>
    public const string ItemKey = "ep:correlation_id";

    private readonly RequestDelegate _next = next ?? throw new ArgumentNullException(nameof(next));

    /// <summary>Processes the request.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var correlationId = context.Request.Headers.TryGetValue(HttpHeaderNames.CorrelationId, out var header)
                && !string.IsNullOrWhiteSpace(header)
            ? header.ToString()
            : Guid.NewGuid().ToString("D");

        context.Items[ItemKey] = correlationId;
        context.Response.Headers[HttpHeaderNames.CorrelationId] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context).ConfigureAwait(false);
        }
    }
}
