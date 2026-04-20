using Microsoft.AspNetCore.Mvc;

namespace Enterprise.Platform.Web.UI.Controllers;

/// <summary>
/// <b>[–] Deferred with D4.</b> BFF authentication surface — login / logout /
/// refresh / OIDC callback. The real implementation needs <c>TokenService</c> + a
/// PlatformDb refresh-token store, both of which stay deferred until PlatformDb is
/// revisited. Every endpoint below returns 501 so the route surface is discoverable
/// (Swagger, Angular devs iterating against the BFF) without pretending to work.
/// </summary>
/// <remarks>
/// Expected shape once D4 lifts:
/// <list type="bullet">
///   <item><c>POST /api/auth/login</c> — validates credentials via the Api, stashes refresh token in the cookie ticket, returns user summary.</item>
///   <item><c>POST /api/auth/logout</c> — invalidates the cookie + asks the Api to revoke the refresh token.</item>
///   <item><c>POST /api/auth/refresh</c> — rotates the refresh token from the cookie; returns a new session tail.</item>
///   <item><c>GET  /signin-oidc</c> — OIDC callback; activated by <c>AddOpenIdConnect</c> in <see cref="Configuration.BffAuthenticationSetup"/>.</item>
/// </list>
/// </remarks>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    /// <summary>Placeholder login endpoint — returns 501 until D4 lifts.</summary>
    [HttpPost("login")]
    public IActionResult Login() => NotImplemented("login");

    /// <summary>Placeholder logout endpoint.</summary>
    [HttpPost("logout")]
    public IActionResult Logout() => NotImplemented("logout");

    /// <summary>Placeholder refresh endpoint.</summary>
    [HttpPost("refresh")]
    public IActionResult Refresh() => NotImplemented("refresh");

    private ObjectResult NotImplemented(string action) => StatusCode(
        StatusCodes.Status501NotImplemented,
        new
        {
            title = "BFF auth surface deferred with D4.",
            detail = $"'{action}' activates when PlatformDb's refresh-token store + TokenService come online.",
            action,
        });
}
