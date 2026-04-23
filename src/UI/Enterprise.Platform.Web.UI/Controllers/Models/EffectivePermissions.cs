namespace Enterprise.Platform.Web.UI.Controllers.Models;

/// <summary>
/// JSON contract returned by <c>GET /api/auth/me/permissions</c>. Mirrors the
/// SPA's <c>EffectivePermissions</c> TypeScript interface so the wire shape
/// is stable across the D4-deferred hydration cutover.
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
