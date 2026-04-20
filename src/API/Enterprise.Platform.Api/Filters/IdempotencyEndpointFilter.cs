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
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);

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
}
