using System.Security.Claims;
using Enterprise.Platform.Contracts.DTOs.Chrome;

namespace Enterprise.Platform.Web.UI.Services.Chrome;

/// <summary>
/// Builds the platform's <see cref="ChromeConfigDto"/> (navbar + footer) for
/// the authenticated principal. Lives behind an interface so Phase 2 (DB-backed
/// per-user filtering) is a pure DI swap with zero call-site change.
/// </summary>
/// <remarks>
/// <para>
/// <b>Phase 1 implementation</b> (<see cref="StaticChromeBuilder"/>) returns a
/// single hardcoded chrome regardless of the principal — no permission
/// filtering yet. The principal is plumbed through anyway so Phase 2 doesn't
/// have to renegotiate the contract.
/// </para>
/// <para>
/// <b>Phase 2 implementation</b> (planned) will:
/// <list type="number">
///   <item>Match the Entra <c>oid</c> against <c>Users.ExternalIdentityId</c>.</item>
///   <item>Load the user's modules / roles / fine-grained permissions.</item>
///   <item>Filter the static base config — drop <c>NavMenuItem</c>s the user
///     can't see (defense-in-depth alongside the SPA's <c>NavMenuComponent</c>
///     re-filter).</item>
///   <item>Cache by user id (TTL = cookie lifetime) in <c>IDistributedCache</c>
///     so the SQL round-trip is paid once per session.</item>
/// </list>
/// </para>
/// </remarks>
public interface IChromeBuilder
{
    /// <summary>
    /// Builds the chrome config for the current principal. Phase 1 ignores the
    /// principal (returns the static config); Phase 2 filters by user identity
    /// + permissions.
    /// </summary>
    /// <param name="user">The authenticated principal off <c>HttpContext.User</c>.</param>
    /// <param name="cancellationToken">Cooperative cancellation for Phase 2 SQL work.</param>
    Task<ChromeConfigDto> BuildAsync(ClaimsPrincipal user, CancellationToken cancellationToken);

    /// <summary>
    /// Builds the login-page config served on the anonymous endpoint
    /// <c>GET /api/auth/login-config</c>. The user is NOT authenticated yet,
    /// so the only input is a tenant hint resolved from the request
    /// (subdomain, custom-domain header, or <c>?tenant=</c> query) — Phase 2
    /// uses this to fan out per-tenant branding before sign-in.
    /// </summary>
    /// <param name="tenantHint">
    /// Tenant identifier resolved from the request, or <c>null</c> for the
    /// default branding. Phase 1 ignores this argument.
    /// </param>
    /// <param name="cancellationToken">Cooperative cancellation for Phase 2 SQL work.</param>
    Task<LoginPageConfigDto> BuildLoginAsync(string? tenantHint, CancellationToken cancellationToken);
}
