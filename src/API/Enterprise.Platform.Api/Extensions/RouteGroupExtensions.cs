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
    /// Creates a route group rooted at <c>/api/v1</c> with the platform's standard
    /// endpoint-filter stack pre-attached:
    /// <list type="bullet">
    ///   <item><see cref="IdempotencyEndpointFilter"/> — every mutation gets the
    ///   <c>X-Idempotency-Key</c> contract automatically. GETs are unaffected
    ///   because the filter only enforces on non-safe verbs at the inner check.</item>
    /// </list>
    /// Endpoint authors map under this group:
    /// <code>
    /// var v1 = app.MapPlatformApiV1Group();
    /// v1.MapPost("/orders", CreateOrderHandler).WithName("CreateOrder");
    /// </code>
    /// </summary>
    /// <remarks>
    /// Per-endpoint exemption: endpoints that are intentionally non-idempotent
    /// (rare — usually operational debug endpoints) can declare a marker filter
    /// or live outside the group. Document the exception in the endpoint's
    /// XML comment so reviewers understand why.
    /// </remarks>
    public static RouteGroupBuilder MapPlatformApiV1Group(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.MapGroup("/api/v1")
            .AddEndpointFilter<IdempotencyEndpointFilter>();
    }
}
