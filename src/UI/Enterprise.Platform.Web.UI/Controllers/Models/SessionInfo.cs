using Enterprise.Platform.Contracts.DTOs.Chrome;

namespace Enterprise.Platform.Web.UI.Controllers.Models;

/// <summary>
/// JSON shape returned by <c>GET /api/auth/session</c>. The single startup
/// envelope the SPA reads after the post-login redirect lands — bundles
/// identity, role labels, fine-grained permissions, and the navbar/footer
/// chrome config so first paint has everything it needs without a chain of
/// follow-up calls.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why bundled vs split.</b> OIDC's redirect-based flow has no JSON body
/// for the SPA to read on success — the SPA boots fresh after the cookie is
/// set. The first <c>/api/auth/session</c> call is therefore the de-facto
/// "post-login response": piggybacking permissions + chrome onto it eliminates
/// two extra round-trips the shell would otherwise need before first paint.
/// </para>
/// <para>
/// <b>Token + claim safety.</b> NEVER returns access tokens, refresh tokens,
/// or sensitive claim values — strictly identity, coarse role labels,
/// permission strings, and chrome config. Tokens stay in the server-side
/// ticket and the BFF attaches them to downstream calls via the proxy.
/// </para>
/// </remarks>
/// <param name="IsAuthenticated">Whether a valid host session cookie backs this request.</param>
/// <param name="Name">Display name (<c>name</c> claim) when authenticated, else <c>null</c>.</param>
/// <param name="Email">Contact email — tries <c>email</c>, <c>preferred_username</c>, then the schema URL claim.</param>
/// <param name="Roles">Distinct app-role values. Empty when none assigned; never <c>null</c>.</param>
/// <param name="Permissions">
/// Fine-grained permission strings (e.g. <c>users.read</c>). Phase 1 returns
/// empty until the platform identity store / SQL hydration ships; the wire
/// shape stays stable so the SPA's <c>AuthStore.hydrate()</c> consumer needs
/// no changes when the real values land.
/// </param>
/// <param name="Chrome">
/// Navbar + footer config the SPA's <c>NavbarConfigService</c> hydrates from.
/// Built by <c>IChromeBuilder</c>; Phase 1 is a single hardcoded shape, Phase 2
/// will filter per user / module / role.
/// </param>
/// <param name="ExpiresAt">Cookie expiration instant used by <c>SessionMonitorService</c>.</param>
public sealed record SessionInfo(
    bool IsAuthenticated,
    string? Name,
    string? Email,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    ChromeConfigDto? Chrome,
    DateTimeOffset? ExpiresAt)
{
    /// <summary>
    /// Singleton returned when <c>User.Identity.IsAuthenticated</c> is false.
    /// Anonymous responses carry no chrome — the SPA already renders a login
    /// page rather than the authenticated shell, so no chrome is needed.
    /// </summary>
    public static SessionInfo Anonymous { get; } = new(
        IsAuthenticated: false,
        Name: null,
        Email: null,
        Roles: Array.Empty<string>(),
        Permissions: Array.Empty<string>(),
        Chrome: null,
        ExpiresAt: null);
}
