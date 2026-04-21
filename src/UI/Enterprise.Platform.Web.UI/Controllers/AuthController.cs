using System.Security.Claims;
using Enterprise.Platform.Web.UI.Configuration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Enterprise.Platform.Web.UI.Controllers;

/// <summary>
/// BFF authentication surface. Three endpoints bridge the SPA to the OIDC
/// plumbing registered in <see cref="BffAuthenticationSetup"/>:
/// <list type="bullet">
///   <item><c>GET  /api/auth/login</c>  — triggers the Entra authorization-code + PKCE flow.</item>
///   <item><c>POST /api/auth/logout</c> — clears the BFF session cookie AND signs the user out of Entra.</item>
///   <item><c>GET  /api/auth/session</c> — projects the cookie-backed identity into a JSON session summary the SPA polls.</item>
/// </list>
/// <para>
/// The OIDC callback itself (<c>/signin-oidc</c>) is handled entirely by the
/// <see cref="Microsoft.AspNetCore.Authentication.OpenIdConnect.OpenIdConnectHandler"/>
/// — no controller action is needed. Same for the signed-out callback.
/// </para>
/// </summary>
/// <remarks>
/// <b>Open-redirect defense.</b> Both <see cref="Login"/> and <see cref="Logout"/>
/// accept a caller-supplied <c>returnUrl</c>. We feed it through
/// <see cref="Microsoft.AspNetCore.Mvc.IUrlHelper.IsLocalUrl"/> which rejects
/// absolute URLs, protocol-relative <c>//</c> URLs, and backslash-escape tricks
/// — anything that fails falls back to <c>/</c>. This prevents the classic
/// "login page redirects to attacker.com" attack.
/// </remarks>
[ApiController]
[Route("api/auth")]
public sealed partial class AuthController(ILogger<AuthController> logger) : ControllerBase
{
    private readonly ILogger<AuthController> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    private const string DefaultReturnUrl = "/";

    // ── source-generated log delegates (CA1848 compliance) ─────────────

    [LoggerMessage(EventId = 1001, Level = LogLevel.Information,
        Message = "Auth.Login.AlreadyAuthenticated — short-circuit redirect to {ReturnUrl}.")]
    private partial void LogLoginAlreadyAuthenticated(string returnUrl);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Information,
        Message = "Auth.Login.Challenge — issuing OIDC challenge, returnUrl={ReturnUrl}.")]
    private partial void LogLoginChallenge(string returnUrl);

    [LoggerMessage(EventId = 1003, Level = LogLevel.Information,
        Message = "Auth.Logout.AlreadyAnonymous — short-circuit redirect to {ReturnUrl}.")]
    private partial void LogLogoutAlreadyAnonymous(string returnUrl);

    [LoggerMessage(EventId = 1004, Level = LogLevel.Information,
        Message = "Auth.Logout.SignOut — clearing cookie + initiating Entra single sign-out.")]
    private partial void LogLogoutSignOut();

    /// <summary>
    /// Begins the OIDC login flow. The SPA redirects the user's browser here as a
    /// top-level navigation; this action issues a 302 to Entra's authorize endpoint
    /// which returns a code to <c>/signin-oidc</c>. The OIDC middleware then
    /// completes the code-for-token exchange, writes the BFF session cookie, and
    /// sends the browser to <paramref name="returnUrl"/>.
    /// </summary>
    /// <param name="returnUrl">Local path (must start with <c>/</c>) to land on after login.</param>
    /// <returns>
    /// <c>302</c> to Entra when the user is unauthenticated, or <c>302</c> to
    /// <paramref name="returnUrl"/> directly when a valid session already exists
    /// (idempotent — repeated login clicks don't retrigger the full flow).
    /// </returns>
    [AllowAnonymous]
    [HttpGet("login")]
    public IActionResult Login([FromQuery] string? returnUrl)
    {
        var safeReturnUrl = SanitizeReturnUrl(returnUrl);

        if (User.Identity?.IsAuthenticated == true)
        {
            LogLoginAlreadyAuthenticated(safeReturnUrl);
            return LocalRedirect(safeReturnUrl);
        }

        LogLoginChallenge(safeReturnUrl);

        // AuthenticationProperties.RedirectUri is what the OIDC middleware
        // redirects to after a successful code-for-token exchange. Entra
        // preserves our `state` parameter across the round-trip, which is
        // how this value survives the cross-origin hop.
        var properties = new AuthenticationProperties { RedirectUri = safeReturnUrl };
        return Challenge(properties, BffAuthenticationSetup.OidcScheme);
    }

    /// <summary>
    /// Logs the user out of both the BFF cookie scheme AND Entra (single
    /// sign-out). Issued as <c>POST</c> so preloaders / link previews can't
    /// accidentally sign people out.
    /// </summary>
    /// <param name="returnUrl">Local path to land on after Entra's logout flow completes.</param>
    /// <returns>
    /// <c>302</c> to Entra's end-session endpoint when authenticated, or <c>302</c>
    /// straight to <paramref name="returnUrl"/> when already signed out (tolerant).
    /// </returns>
    [AllowAnonymous]
    [HttpPost("logout")]
    public IActionResult Logout([FromQuery] string? returnUrl)
    {
        var safeReturnUrl = SanitizeReturnUrl(returnUrl);

        if (User.Identity?.IsAuthenticated != true)
        {
            LogLogoutAlreadyAnonymous(safeReturnUrl);
            return LocalRedirect(safeReturnUrl);
        }

        LogLogoutSignOut();

        var properties = new AuthenticationProperties { RedirectUri = safeReturnUrl };

        // Passing BOTH schemes triggers: (1) clear the BFF cookie, and
        // (2) redirect to Entra's end-session endpoint which then returns
        // the user to our SignedOutCallbackPath, which finally redirects
        // to AuthenticationProperties.RedirectUri. SPA sees the full flow
        // as a single top-level navigation.
        return SignOut(
            properties,
            BffAuthenticationSetup.CookieScheme,
            BffAuthenticationSetup.OidcScheme);
    }

    /// <summary>
    /// Returns a JSON summary of the current session. Called by the SPA on app
    /// bootstrap + periodically by <c>SessionMonitorService</c> (Phase 9.D.7) to
    /// drive the expiry-warning dialog and to replace MSAL's <c>inProgress$</c>
    /// stream.
    /// </summary>
    /// <remarks>
    /// NEVER returns tokens or sensitive claims — strictly identity + roles +
    /// expiry. The access token stays in the server-side ticket.
    /// </remarks>
    /// <returns>A <see cref="SessionInfo"/> envelope; <c>IsAuthenticated=false</c> when anonymous.</returns>
    [AllowAnonymous]
    [HttpGet("session")]
    [ProducesResponseType<SessionInfo>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SessionInfo>> Session(CancellationToken cancellationToken)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(SessionInfo.Anonymous);
        }

        // ExpiresUtc lives on the cookie's AuthenticationProperties — not on
        // the ClaimsPrincipal. AuthenticateAsync re-materializes it for us.
        var auth = await HttpContext.AuthenticateAsync(BffAuthenticationSetup.CookieScheme).ConfigureAwait(false);
        var expiresAt = auth?.Properties?.ExpiresUtc;

        var name = User.FindFirst("name")?.Value
            ?? User.Identity?.Name;

        // Entra's canonical user-email claim priority: `email` (if present) →
        // `preferred_username` (upn-like, almost always present) → the URL-
        // schema email claim that surfaces in some tenants.
        var email = User.FindFirst("email")?.Value
            ?? User.FindFirst("preferred_username")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value;

        // Duplicate-claims defense — same pattern as the whoami fix. Entra
        // emits multiple `roles` claims when the user has multiple app roles.
        var roles = User.FindAll(ClaimTypes.Role)
            .Concat(User.FindAll("roles"))
            .Select(c => c.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var session = new SessionInfo(
            IsAuthenticated: true,
            Name: name,
            Email: email,
            Roles: roles,
            ExpiresAt: expiresAt);

        _ = cancellationToken; // present for future-proofing; no async work uses it yet
        return Ok(session);
    }

    // ── helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Validates and normalizes a caller-supplied <c>returnUrl</c>. Accepts only
    /// paths the framework agrees are local; everything else collapses to
    /// <see cref="DefaultReturnUrl"/> — the single-line open-redirect defense.
    /// </summary>
    private string SanitizeReturnUrl(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return DefaultReturnUrl;
        }

        return Url.IsLocalUrl(candidate) ? candidate : DefaultReturnUrl;
    }
}

/// <summary>
/// JSON shape returned by <c>GET /api/auth/session</c>. Deliberately minimal —
/// the SPA never needs more than this to render name/badge/roles + drive the
/// expiry-warning clock.
/// </summary>
/// <param name="IsAuthenticated">Whether a valid BFF session cookie backs this request.</param>
/// <param name="Name">Display name (<c>name</c> claim), or <c>null</c> anonymous.</param>
/// <param name="Email">Contact email — tries <c>email</c>, <c>preferred_username</c>, then the schema URL claim.</param>
/// <param name="Roles">Distinct app-role values. Empty when none assigned; never <c>null</c>.</param>
/// <param name="ExpiresAt">Cookie expiration instant used by <c>SessionMonitorService</c>.</param>
public sealed record SessionInfo(
    bool IsAuthenticated,
    string? Name,
    string? Email,
    IReadOnlyList<string> Roles,
    DateTimeOffset? ExpiresAt)
{
    /// <summary>Singleton returned when <c>User.Identity.IsAuthenticated</c> is false.</summary>
    public static SessionInfo Anonymous { get; } = new(
        IsAuthenticated: false,
        Name: null,
        Email: null,
        Roles: Array.Empty<string>(),
        ExpiresAt: null);
}
