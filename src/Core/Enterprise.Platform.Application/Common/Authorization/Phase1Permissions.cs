using Enterprise.Platform.Application.Features.Users;

namespace Enterprise.Platform.Application.Common.Authorization;

/// <summary>
/// Single source-of-truth for the Phase-1 permission grant. Until the
/// platform identity store ships (Phase 2), every authenticated user gets
/// the full feature-permission set; this class names that fact so the BFF
/// hydration endpoints (<c>/api/auth/me/permissions</c> + the
/// <c>/api/auth/session?include=chrome</c> envelope), the BFF cookie-claim
/// seeding (<c>OnTokenValidated</c> in <c>PlatformAuthenticationSetup</c>),
/// and the Api's <c>IClaimsTransformation</c> all read from the same list.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why three call-sites need the same list.</b>
/// <list type="number">
///   <item><b>SPA hydration</b> drives client-side UX gating (nav menu
///     visibility, route guards) via <c>AuthStore.permissions()</c>.</item>
///   <item><b>BFF cookie claims</b> gate <i>BFF-served</i> endpoints
///     (<c>AuthController</c> actions decorated with permission policies).</item>
///   <item><b>Api claims transformation</b> gates <i>Api-served</i> endpoints
///     reached via the BFF proxy — the JWT from Entra never carries
///     <c>ep:permission</c> claims, so the Api enriches the principal at
///     authentication time before policies run.</item>
/// </list>
/// If any one drifts, the symptom is "menu item visible but the page
/// returns 403" or its inverse — exactly the bug pattern this class
/// prevents.
/// </para>
/// <para>
/// <b>Phase 2 migration.</b> Replace this static <see cref="All"/> with a
/// per-user resolver service (<c>IPermissionsResolver</c>) that takes a
/// <see cref="System.Security.Claims.ClaimsPrincipal"/> and returns the
/// user's actual permissions from SQL (Users → UserModules → Permissions).
/// All three call-sites switch from the static to the injected service in
/// lock-step; the wire shape on either end stays unchanged.
/// </para>
/// <para>
/// <b>Adding new feature permissions.</b> Concatenate the new feature's
/// <c>*Permissions</c> static class entries here. The order doesn't matter
/// — every consumer hydrates into a HashSet for O(1) membership checks.
/// </para>
/// </remarks>
public static class Phase1Permissions
{
    /// <summary>
    /// Every permission a Phase-1 authenticated user receives. Treat as
    /// immutable — the value identity is the contract.
    /// </summary>
    public static IReadOnlyList<string> All { get; } =
    [
        UserPermissions.Read,
        UserPermissions.Create,
        UserPermissions.Write,
        UserPermissions.Activate,
        UserPermissions.Deactivate,
    ];
}
