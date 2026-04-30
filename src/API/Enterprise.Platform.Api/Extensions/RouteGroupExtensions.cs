using Enterprise.Platform.Api.Filters;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace Enterprise.Platform.Api.Extensions;

/// <summary>
/// P1-8 (audit) — route-group helpers that bundle cross-cutting endpoint filters
/// so individual endpoints don't have to opt-in (and can't accidentally forget to).
/// </summary>
public static class RouteGroupExtensions
{
    /// <summary>
    /// Creates a route group rooted at <c>/api/v1</c>. The platform's
    /// idempotency contract is applied per-mutation via
    /// <see cref="RequireIdempotencyKey"/> (extension below), NOT at the group
    /// level — applying the filter to the whole group used to swallow GETs
    /// when the in-filter safe-method short-circuit and the running binary
    /// went out of sync. Per-endpoint attachment makes the contract explicit
    /// at the call-site and physically removes any path by which a read can
    /// hit the idempotency check.
    /// </summary>
    /// <remarks>
    /// Endpoint authors map under this group, then opt mutations into the
    /// idempotency check explicitly:
    /// <code>
    /// var v1 = app.MapPlatformApiV1Group();
    /// v1.MapPost("/orders", CreateOrderHandler).RequireIdempotencyKey().WithName("CreateOrder");
    /// </code>
    /// </remarks>
    public static RouteGroupBuilder MapPlatformApiV1Group(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.MapGroup("/api/v1");
    }

    /// <summary>
    /// Attaches <see cref="IdempotencyEndpointFilter"/> to a mutation endpoint.
    /// Use exclusively on POST / PUT / PATCH / DELETE — GETs and other safe
    /// verbs must never carry this filter, since they have no payload to
    /// deduplicate and the filter would force callers to send a meaningless
    /// <c>X-Idempotency-Key</c> header.
    /// </summary>
    public static RouteHandlerBuilder RequireIdempotencyKey(this RouteHandlerBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        return builder.AddEndpointFilter<IdempotencyEndpointFilter>();
    }
}
