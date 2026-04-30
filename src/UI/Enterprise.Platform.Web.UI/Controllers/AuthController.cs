using System.Security.Claims;
using Enterprise.Platform.Application.Common.Authorization;
using Enterprise.Platform.Contracts.DTOs.Auth;
using Enterprise.Platform.Web.UI.Controllers.Models;
using Enterprise.Platform.Web.UI.Services.Chrome;
using Enterprise.Platform.Web.UI.Services.Graph;
using Enterprise.Platform.Web.UI.Setup;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Enterprise.Platform.Web.UI.Controllers;

/// <summary>
/// Web.UI authentication surface. Endpoints bridge the SPA to the OIDC
/// plumbing registered in <see cref="PlatformAuthenticationSetup"/>:
/// <list type="bullet">
///   <item><c>GET  /api/auth/login</c>          — triggers the Entra authorization-code + PKCE flow.</item>
///   <item><c>POST /api/auth/logout</c>         — clears the host session cookie AND signs the user out of Entra.</item>
///   <item><c>GET  /api/auth/session</c>        — projects the cookie-backed identity into a JSON session summary the SPA polls.</item>
///   <item><c>GET  /api/auth/me/profile</c>     — Microsoft Graph <c>/me</c> projection (cached, claim fallback).</item>
///   <item><c>GET  /api/auth/me/permissions</c> — placeholder until D4 hydration lifts; returns empty fine-grained permissions.</item>
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
    /// completes the code-for-token exchange, writes the host session cookie, and
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
            properties.Items[PlatformAuthenticationSetup.PromptPropertyKey] = safePrompt;
        }
        return Challenge(properties, PlatformAuthenticationSetup.OidcScheme);
    }

    /// <summary>
    /// Logs the user out of both the host cookie scheme AND Entra (single
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

        // Passing BOTH schemes triggers: (1) clear the host cookie, and
        // (2) redirect to Entra's end-session endpoint which then returns
        // the user to our SignedOutCallbackPath, which finally redirects
        // to AuthenticationProperties.RedirectUri. SPA sees the full flow
        // as a single top-level navigation.
        return SignOut(
            properties,
            PlatformAuthenticationSetup.CookieScheme,
            PlatformAuthenticationSetup.OidcScheme);
    }

    /// <summary>
    /// Returns a JSON summary of the current session. Default response is
    /// lightweight (identity, role labels, expiry) so <c>SessionMonitorService</c>
    /// can poll it cheaply every <c>session.pollIntervalSeconds</c>. Pass
    /// <c>?include=chrome</c> to additionally embed the navbar/footer config —
    /// the SPA does this exactly once on bootstrap via
    /// <c>AuthService.refreshSession()</c> so the post-login shell paints
    /// without a chain of follow-up calls.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Why conditional payload.</b> Chrome is several KB; bundling it on
    /// every monitor tick (one per minute, sustained over an 8-hour cookie
    /// lifetime) wastes bandwidth + serialisation cycles for no UI benefit
    /// — the monitor only ever reads <c>expiresAt</c>. The query flag splits
    /// the two access patterns through a single endpoint without API-surface
    /// bloat.
    /// </para>
    /// <para>
    /// NEVER returns tokens or sensitive claims — strictly identity + roles
    /// + (optional) permissions + (optional) chrome + expiry. The access
    /// token stays in the server-side ticket.
    /// </para>
    /// <para>
    /// Chrome is built by <see cref="IChromeBuilder"/>; Phase 1 returns a
    /// hardcoded config, Phase 2 will filter per user / module / role from
    /// SQL. The SPA's <c>NavbarConfigService.hydrate</c> consumes the
    /// <c>chrome</c> field directly when present — no separate
    /// <c>/me/chrome</c> endpoint exists.
    /// </para>
    /// </remarks>
    /// <param name="chromeBuilder">DI-injected; only invoked when chrome is requested.</param>
    /// <param name="include">
    /// Comma-separated opt-in flags for heavy fields. Recognised: <c>chrome</c>.
    /// Anything else is ignored (tolerant of future-flag mistakes).
    /// </param>
    /// <param name="cancellationToken">Cooperative cancellation for chrome build.</param>
    /// <returns>A <see cref="SessionInfo"/> envelope; <c>IsAuthenticated=false</c> when anonymous.</returns>
    [AllowAnonymous]
    [HttpGet("session")]
    [ProducesResponseType<SessionInfo>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SessionInfo>> Session(
        [FromServices] IChromeBuilder chromeBuilder,
        [FromQuery] string? include,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(chromeBuilder);

        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(SessionInfo.Anonymous);
        }

        // ExpiresUtc lives on the cookie's AuthenticationProperties — not on
        // the ClaimsPrincipal. AuthenticateAsync re-materializes it for us.
        var auth = await HttpContext.AuthenticateAsync(PlatformAuthenticationSetup.CookieScheme).ConfigureAwait(false);
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

        // Phase 1: hardcoded grant of the full feature-permission set for any
        // authenticated user. Phase 2 will replace with a SQL query against
        // the platform's identity store (Users → UserModules → Permissions).
        // The wire shape is stable so the SPA's AuthStore.hydrate consumer
        // needs no changes when real values land.
        var permissions = BuildPhase1Permissions();

        // Build chrome only when the caller asked for it — keeps the
        // SessionMonitorService poll cheap. The query flag is the SINGLE
        // signal; absent / unrecognised → no chrome.
        var chrome = WantsInclude(include, "chrome")
            ? await chromeBuilder.BuildAsync(User, cancellationToken).ConfigureAwait(false)
            : null;

        var session = new SessionInfo(
            IsAuthenticated: true,
            Name: name,
            Email: email,
            Roles: roles,
            Permissions: permissions,
            Chrome: chrome,
            ExpiresAt: expiresAt);

        return Ok(session);
    }

    /// <summary>
    /// Tolerant comma-split lookup for the <c>?include=</c> query flag.
    /// Case-insensitive. Whitespace-tolerant. Ignores unknown values so
    /// future flag rollouts don't 400 callers that paste the wrong name.
    /// </summary>
    private static bool WantsInclude(string? include, string flag)
    {
        if (string.IsNullOrWhiteSpace(include))
        {
            return false;
        }

        var parts = include.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var part in parts)
        {
            if (string.Equals(part, flag, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
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
    /// Phase-1 placeholder permission set hydrated by the SPA's
    /// <c>AuthStore.hydrate()</c>. Returns the full feature-permission grant
    /// for any authenticated user — no per-user filtering yet, just hardcoded
    /// strings matching <see cref="UserPermissions"/> (and any future feature's
    /// <c>*Permissions</c> static class as modules ship). Phase 2 swaps the
    /// hardcoded array for a SQL query against the platform identity store.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Why grant everything in Phase 1.</b> The SPA's route guards and nav
    /// menu both gate on these strings. An empty list (the prior behaviour)
    /// blocks every authenticated user from reaching gated routes — fail-
    /// closed by accident. Granting the full feature set keeps the platform
    /// usable while the real hydration plumbing ships.
    /// </para>
    /// <para>
    /// <b>Source-of-truth coupling.</b> The list mirrors what
    /// <c>BuildPhase1Permissions</c> emits inside <see cref="Session"/> — the
    /// two endpoints MUST stay in sync; if a SPA component reads from one and
    /// gates on the other, drift would surface as confusing partial-render
    /// bugs.
    /// </para>
    /// <para>
    /// Lives on the host (not the Api) because the eventual hydration is
    /// per-user and benefits from the host's session context — no extra Api
    /// round-trip during the call.
    /// </para>
    /// </remarks>
    [Authorize]
    [HttpGet("me/permissions")]
    [ProducesResponseType<EffectivePermissionsDto>(StatusCodes.Status200OK)]
    public ActionResult<EffectivePermissionsDto> MePermissions()
    {
        LogPermissionsPlaceholder();

        var roles = User.FindAll(ClaimTypes.Role)
            .Concat(User.FindAll("roles"))
            .Select(c => c.Value)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return Ok(new EffectivePermissionsDto(
            Roles: roles,
            Permissions: BuildPhase1Permissions(),
            Bypass: false,
            TtlSeconds: 300));
    }

    /// <summary>
    /// Phase-1 permission grant used by both <see cref="Session"/> and
    /// <see cref="MePermissions"/>. Delegates to the shared
    /// <see cref="Phase1Permissions"/> static so the OIDC cookie-claim seeding
    /// reads from the same source — preventing client/server drift.
    /// </summary>
    private static IReadOnlyList<string> BuildPhase1Permissions() => Phase1Permissions.All;

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
    /// Validates a caller-supplied <c>prompt</c> against the host's allowlist.
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
