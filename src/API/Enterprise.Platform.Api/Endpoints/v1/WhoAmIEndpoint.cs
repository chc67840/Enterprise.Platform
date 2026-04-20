using Microsoft.AspNetCore.Routing;

namespace Enterprise.Platform.Api.Endpoints.v1;

/// <summary>
/// A minimal protected endpoint used by the Phase-8 smoke test to prove auth
/// wiring: an unauthenticated request must receive 401. Returns the authenticated
/// principal's id + email + claim summary when authorized. Replace or augment when
/// real identity endpoints come online in a later phase (D4-deferred).
/// </summary>
public static class WhoAmIEndpoint
{
    /// <summary>Maps GET <c>/api/v1/whoami</c>.</summary>
    public static IEndpointRouteBuilder MapWhoAmI(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapGet("/api/v1/whoami", (HttpContext ctx) =>
        {
            var user = ctx.User;
            var claims = user.Claims.ToDictionary(c => c.Type, c => c.Value, StringComparer.Ordinal);
            return Results.Ok(new
            {
                isAuthenticated = user.Identity?.IsAuthenticated == true,
                name = user.Identity?.Name,
                claimCount = claims.Count,
                claims,
            });
        })
        .RequireAuthorization()
        .WithName("WhoAmI")
        .WithTags("Identity")
        .WithSummary("Returns the authenticated principal's identity + claim set.");

        return app;
    }
}
