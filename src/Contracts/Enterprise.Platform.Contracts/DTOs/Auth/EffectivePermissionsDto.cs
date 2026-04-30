namespace Enterprise.Platform.Contracts.DTOs.Auth;

/// <summary>
/// JSON contract returned by <c>GET /api/auth/me/permissions</c>. The SPA's
/// <c>EffectivePermissions</c> TypeScript interface (in
/// <c>features/.../core/models/auth.model.ts</c>) is the hand-mirror of this
/// record — every property name + casing must round-trip, and the contract
/// test in <c>Enterprise.Platform.Architecture.Tests</c> diffs both sides.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why a Contracts DTO (not a controller-private type).</b> This shape
/// is consumed by <c>AuthStore.hydratePermissions()</c> on the SPA, which
/// is gated by every permission-aware route guard and structural directive.
/// Promoting the record to <c>Enterprise.Platform.Contracts</c> means the
/// Api / BFF / any future microservice can take a dependency on the same
/// type without re-declaring it — closes FLAGS §F7 from
/// <c>Docs/Architecture/MasterConfigModels.cs</c>.
/// </para>
/// <para>
/// <b>Single-tenant.</b> No <c>TenantId</c> field — tenancy was stripped
/// platform-wide on 2026-04-25. To re-introduce, add it here and the
/// matching field on the SPA interface in the same PR.
/// </para>
/// </remarks>
/// <param name="Roles">
/// Coarse role labels (e.g. <c>"admin"</c>, <c>"manager"</c>). Sourced from
/// session claims today; from PlatformDb post-D4 hydration cutover.
/// </param>
/// <param name="Permissions">
/// Fine-grained <c>&lt;aggregate&gt;.&lt;action&gt;</c> dot-form strings
/// (e.g. <c>"users.read"</c>). Compared case-insensitively by
/// <c>RbacPolicyProvider</c>.
/// </param>
/// <param name="Bypass">
/// Server-granted short-circuit. When <c>true</c>, all permission checks
/// short-circuit to allow. Replaces the old <c>"super:admin"</c> magic-string
/// convention — explicit, auditable, revocable without a client release.
/// </param>
/// <param name="TtlSeconds">
/// Hint for the SPA's client-side cache. The store re-hydrates after this
/// many seconds. Defaults to 300 (5 minutes) when <c>null</c>.
/// </param>
public sealed record EffectivePermissionsDto(
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    bool Bypass,
    int? TtlSeconds);
