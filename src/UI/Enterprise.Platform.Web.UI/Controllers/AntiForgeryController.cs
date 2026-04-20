using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace Enterprise.Platform.Web.UI.Controllers;

/// <summary>
/// Issues CSRF tokens for the SPA. Flow:
/// <list type="number">
///   <item>SPA calls <c>GET /api/antiforgery/token</c> once at startup (after login).</item>
///   <item>BFF returns a token in a cookie (<c>XSRF-TOKEN</c>) readable by JavaScript.</item>
///   <item>SPA reads the cookie and echoes it on every mutating XHR in the
///         <c>X-XSRF-TOKEN</c> header; the BFF validates it before dispatching.</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/antiforgery")]
public sealed class AntiForgeryController(IAntiforgery antiforgery) : ControllerBase
{
    private readonly IAntiforgery _antiforgery = antiforgery ?? throw new ArgumentNullException(nameof(antiforgery));

    /// <summary>
    /// Issues a CSRF token cookie + returns a JSON summary. Anonymous is OK —
    /// pre-auth XHRs (e.g. login itself) still need the token.
    /// </summary>
    [HttpGet("token")]
    public IActionResult GetToken()
    {
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);

        Response.Cookies.Append(
            "XSRF-TOKEN",
            tokens.RequestToken ?? string.Empty,
            new CookieOptions
            {
                HttpOnly = false,                         // readable by the SPA by design
                Secure = HttpContext.Request.IsHttps,     // degrade in dev / enforce in prod
                SameSite = SameSiteMode.Strict,
                Path = "/",
            });

        return Ok(new { headerName = tokens.HeaderName });
    }
}
