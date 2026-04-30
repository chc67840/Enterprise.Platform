using HttpHeaderNames = Enterprise.Platform.Shared.Constants.HttpHeaderNames;

namespace Enterprise.Platform.Api.Filters;

/// <summary>
/// Enforces the presence of the <c>X-Idempotency-Key</c> header on opt-in endpoints.
/// The actual de-duplication lives in <c>IdempotencyBehavior</c> (Application-tier);
/// this filter rejects requests that forgot the header altogether so handlers get a
/// clean signal. Apply with <c>.AddEndpointFilter&lt;IdempotencyEndpointFilter&gt;()</c>
/// on commands you care about.
/// </summary>
public sealed class IdempotencyEndpointFilter : IEndpointFilter
{
    /// <inheritdoc />
    /// <remarks>
    /// Safe-verb short-circuit: only mutations require the
    /// <c>X-Idempotency-Key</c> header. GET / HEAD / OPTIONS / TRACE are
    /// definitionally idempotent under HTTP semantics (RFC 7231 §4.2.2),
    /// and demanding the header on a list-users GET would surface as the
    /// confusing "Idempotency key required" 400 the audit fix originally
    /// flagged. The XML on <see cref="IdempotencyEndpointFilter"/> already
    /// promises "GETs are unaffected" — this short-circuit is what makes
    /// that promise true.
    /// </remarks>
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

        if (IsSafeMethod(context.HttpContext.Request.Method))
        {
            return await next(context).ConfigureAwait(false);
        }

        var header = context.HttpContext.Request.Headers[HttpHeaderNames.IdempotencyKey].ToString();
        if (string.IsNullOrWhiteSpace(header))
        {
            return Results.Problem(
                title: "Idempotency key required.",
                detail: $"Requests to this endpoint must include the {HttpHeaderNames.IdempotencyKey} header.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        return await next(context).ConfigureAwait(false);
    }

    /// <summary>
    /// Returns <c>true</c> for HTTP methods that are safe / read-only per
    /// RFC 7231 §4.2.1 — these cannot mutate state and therefore have no
    /// need for client-supplied de-duplication keys.
    /// </summary>
    private static bool IsSafeMethod(string method) =>
        HttpMethods.IsGet(method)
        || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method)
        || HttpMethods.IsTrace(method);
}
