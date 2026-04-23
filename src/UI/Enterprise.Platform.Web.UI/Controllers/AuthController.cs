using System.Security.Claims;
using System.Threading;
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

    [LoggerMessage(EventId = 1005, Level = LogLevel.Debug,
        Message = "Auth.Permissions.Placeholder — returning empty payload (D4 hydration deferred).")]
    private partial void LogPermissionsPlaceholder();

    [LoggerMessage(EventId = 1006, Level = LogLevel.Debug,
        Message = "Auth.MeProfile.Empty — Graph returned no payload; falling back to session-claim shape.")]
    private partial void LogMeProfileEmpty();

    /// <summary>
    /// Begins the OIDC login flow. The SPA redirects the user's browser here as a
    /// top-level navigation; this action issues a 302 to Entra's authorize endpoint
    /// which returns a code to <c>/signin-oidc</c>. The OIDC middleware then
    /// completes the code-for-token exchange, writes the BFF session cookie, and
    /// sends the browser to <paramref name="returnUrl"/>.
    /// </summary>
    /// <param name="returnUrl">Local path (must start with <c>/</c>) to land on after login.</param>
    /// <param name="prompt">
    /// Optional Entra <c>prompt</c> parameter — controls Entra's authorize-page UX.
    /// Validated against an allowlist:
    /// <list type="bullet">
    ///   <item><c>select_account</c> — show the account picker even if a session exists. UX: "switch user".</item>
    ///   <item><c>login</c> — force re-authentication. UX: step-up before sensitive operations.</item>
    /// </list>
    /// Anything else is dropped (defence against open-prompt injection).
    /// When set on an already-authenticated session, the short-circuit is
    /// skipped — the user actually wants the prompt.
    /// </param>
    /// <returns>
    /// <c>302</c> to Entra when the user is unauthenticated OR a prompt is requested,
    /// or <c>302</c> to <paramref name="returnUrl"/> directly when a valid session
    /// already exists and no prompt was requested (idempotent — repeated login
    /// clicks don't retrigger the full flow).
    /// </returns>
    [AllowAnonymous]
    [HttpGet("login")]
    public IActionResult Login([FromQuery] string? returnUrl, [FromQuery] string? prompt)
    {
        var safeReturnUrl = SanitizeReturnUrl(returnUrl);
        var safePrompt = SanitizePrompt(prompt);

        if (User.Identity?.IsAuthenticated == true && safePrompt is null)
        {
            LogLoginAlreadyAuthenticated(safeReturnUrl);
            return LocalRedirect(safeReturnUrl);
        }

        LogLoginChallenge(safeReturnUrl);

        // AuthenticationProperties.RedirectUri is what the OIDC middleware
        // redirects to after a successful code-for-token exchange. Entra
        // preserves our `state` parameter across the round-trip, which is
        // how this value survives the cross-origin hop. Prompt threads
        // through Items[] → consumed by OnRedirectToIdentityProvider.
        var properties = new AuthenticationProperties { RedirectUri = safeReturnUrl };
        if (safePrompt is not null)
        {
            properties.Items[BffAuthenticationSetup.PromptPropertyKey] = safePrompt;
        }
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

    /// <summary>
    /// Returns the signed-in user's Microsoft Graph profile (display name,
    /// job title, mail, office, etc.). Falls back to session-claim data
    /// when Graph is unreachable so the SPA can always render some chrome.
    /// </summary>
    /// <remarks>
    /// Cached server-side per-user for 5 minutes (see
    /// <see cref="GraphUserProfileService"/>). The SPA can poll this lazily
    /// without hammering Graph.
    /// </remarks>
    [Authorize]
    [HttpGet("me/profile")]
    [ProducesResponseType<MeProfileResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MeProfileResponse>> MeProfile(
        [FromServices] GraphUserProfileService graphService,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(graphService);

        var profile = await graphService.GetCurrentUserAsync(HttpContext, cancellationToken).ConfigureAwait(false);

        if (profile is null)
        {
            // Graph unreachable / disabled / refresh-token missing — degrade
            // to the session-claim shape so the SPA always has SOMETHING to
            // render.
            LogMeProfileEmpty();
            return Ok(new MeProfileResponse(
                Id: User.FindFirst("oid")?.Value ?? User.FindFirst("sub")?.Value ?? string.Empty,
                DisplayName: User.FindFirst("name")?.Value,
                GivenName: null,
                Surname: null,
                JobTitle: null,
                Mail: User.FindFirst("email")?.Value
                    ?? User.FindFirst("preferred_username")?.Value,
                UserPrincipalName: User.FindFirst("preferred_username")?.Value,
                OfficeLocation: null,
                Department: null,
                PreferredLanguage: null,
                Source: "claims"));
        }

        return Ok(new MeProfileResponse(
            Id: profile.Id,
            DisplayName: profile.DisplayName,
            GivenName: profile.GivenName,
            Surname: profile.Surname,
            JobTitle: profile.JobTitle,
            Mail: profile.Mail,
            UserPrincipalName: profile.UserPrincipalName,
            OfficeLocation: profile.OfficeLocation,
            Department: profile.Department,
            PreferredLanguage: profile.PreferredLanguage,
            Source: "graph"));
    }

    /// <summary>
    /// Placeholder permission set. Returns an empty <see cref="EffectivePermissions"/>
    /// payload so the SPA's <c>AuthStore.hydrate()</c> resolves cleanly instead
    /// of seeing the recurring 404 the proxy was producing for the absent Api
    /// endpoint. <b>Replace with real PlatformDb-backed hydration when D4 lifts</b>
    /// — the call signature here matches what the eventual real implementation
    /// will return, so the SPA needs no changes at that point.
    /// </summary>
    /// <remarks>
    /// Lives on the BFF (not the Api) because the eventual hydration is per-user
    /// and benefits from the BFF's session context — no extra Api round-trip
    /// during the call. Roles surface from the session claims so the UI can
    /// already render coarse role badges; fine-grained permissions stay empty
    /// until the platform identity store ships.
    /// </remarks>
    [Authorize]
    [HttpGet("me/permissions")]
    [ProducesResponseType<EffectivePermissions>(StatusCodes.Status200OK)]
    public ActionResult<EffectivePermissions> MePermissions()
    {
        LogPermissionsPlaceholder();

        var roles = User.FindAll(ClaimTypes.Role)
            .Concat(User.FindAll("roles"))
            .Select(c => c.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return Ok(new EffectivePermissions(
            Roles: roles,
            Permissions: Array.Empty<string>(),
            TenantId: null,
            Bypass: false,
            TtlSeconds: 300));
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

    /// <summary>
    /// Validates a caller-supplied <c>prompt</c> against the BFF's allowlist.
    /// Returns the canonical lowercase form on match, <c>null</c> on miss —
    /// callers treat <c>null</c> as "no prompt requested". Defends against
    /// arbitrary OIDC parameter injection by NEVER forwarding values we
    /// don't explicitly support (e.g. <c>consent</c> is admin-tier and not
    /// exposed via the SPA).
    /// </summary>
    private static string? SanitizePrompt(string? candidate) =>
        candidate?.Trim().ToLowerInvariant() switch
        {
            "select_account" => "select_account",
            "login" => "login",
            _ => null,
        };
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

/// <summary>
/// JSON contract returned by <c>GET /api/auth/me/profile</c>. Surfaces the
/// Graph <c>/me</c> shape augmented with a <see cref="Source"/> discriminator
/// so the SPA can distinguish Graph-backed responses from session-claim
/// fallbacks (network failure, Graph-not-consented, etc.).
/// </summary>
/// <param name="Id">Stable Entra object id.</param>
/// <param name="DisplayName">Full display name (Graph-preferred, claim fallback).</param>
/// <param name="GivenName">First name (Graph-only; null on claim fallback).</param>
/// <param name="Surname">Last name (Graph-only; null on claim fallback).</param>
/// <param name="JobTitle">Org-chart job title (Graph-only).</param>
/// <param name="Mail">Primary email (Graph-preferred; falls back to <c>email</c> / <c>preferred_username</c> claim).</param>
/// <param name="UserPrincipalName">UPN (Graph or <c>preferred_username</c> claim).</param>
/// <param name="OfficeLocation">Office building / room (Graph-only).</param>
/// <param name="Department">Department name (Graph-only).</param>
/// <param name="PreferredLanguage">Locale tag (Graph-only).</param>
/// <param name="Source"><c>"graph"</c> when Graph returned data; <c>"claims"</c> for fallback.</param>
public sealed record MeProfileResponse(
    string Id,
    string? DisplayName,
    string? GivenName,
    string? Surname,
    string? JobTitle,
    string? Mail,
    string? UserPrincipalName,
    string? OfficeLocation,
    string? Department,
    string? PreferredLanguage,
    string Source);

/// <summary>
/// JSON contract returned by <c>GET /api/auth/me/permissions</c>. Mirrors the
/// SPA's <c>EffectivePermissions</c> TypeScript interface so the wire shape is
/// stable across the D4-deferred hydration cutover.
/// </summary>
/// <param name="Roles">Coarse role labels — sourced from session claims today; from PlatformDb post-D4.</param>
/// <param name="Permissions">Fine-grained <c>resource:action</c> strings. Empty until D4 lifts.</param>
/// <param name="TenantId">Platform tenant id (NOT the AAD <c>tid</c>). <c>null</c> for super-admins.</param>
/// <param name="Bypass">When <c>true</c>, all permission checks short-circuit to allow.</param>
/// <param name="TtlSeconds">Hint for the SPA's client-side cache; defaults to 300 if omitted.</param>
public sealed record EffectivePermissions(
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    string? TenantId,
    bool Bypass,
    int? TtlSeconds);
