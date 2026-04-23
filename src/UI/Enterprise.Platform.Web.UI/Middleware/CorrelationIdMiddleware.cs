using Serilog.Context;
using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Web.UI.Middleware;

/// <summary>
/// Mints / echoes <c>X-Correlation-ID</c> on every request and pushes it into
/// the Serilog <c>LogContext</c> so all log lines for this request carry the
/// same id. Mirrors the Api host's convention so a single id ties browser →
/// Web.UI → Api log lines into one query.
/// </summary>
/// <remarks>
/// Inbound: if the client sent <c>X-Correlation-ID</c>, we use it. Otherwise
/// we mint a fresh GUID-D ("00000000-0000-0000-0000-000000000000" shape).
/// Outbound: always echoed on the response so the SPA's
/// <c>correlationInterceptor</c> can latch onto the same id for retries.
/// </remarks>
public static class CorrelationIdMiddleware
{
    /// <summary>Registers the correlation-id middleware.</summary>
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(async (ctx, next) =>
        {
            var correlationId = ctx.Request.Headers.TryGetValue(HttpHeaderNames.CorrelationId, out var header)
                    && !string.IsNullOrWhiteSpace(header)
                ? header.ToString()
                : Guid.NewGuid().ToString("D");

            ctx.Response.Headers[HttpHeaderNames.CorrelationId] = correlationId;

            using (LogContext.PushProperty("CorrelationId", correlationId))
            {
                await next().ConfigureAwait(false);
            }
        });
    }
}
