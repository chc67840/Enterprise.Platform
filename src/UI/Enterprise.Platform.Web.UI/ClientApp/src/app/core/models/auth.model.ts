/**
 * ─── AUTH MODELS ────────────────────────────────────────────────────────────────
 *
 * WHY
 *   Two distinct things the auth layer deals with:
 *
 *     1. `CurrentUser` — what the UI displays in headers, avatars, greetings.
 *        Projected from the MSAL `AccountInfo` plus select id-token claims.
 *
 *     2. `EffectivePermissions` — authoritative authorization decisions.
 *        Fetched from `GET /api/v1/me/permissions` after login (see
 *        Architecture §3.2, TODO 1.2.2). Never derived from the id-token
 *        client-side — roles in the JWT are coarse labels, not fine-grained
 *        permission strings.
 *
 * WHY SEPARATE
 *   The current user is a public UX concern (signal any template can bind to).
 *   Permissions are a guarded authorization concern — their hydration is
 *   side-effect-producing and can fail (network, 401). Separating the types
 *   prevents accidental coupling (e.g. "show user menu only when permissions
 *   loaded" would be a bug — show the menu as soon as the account resolves).
 *
 * HOW IT'S USED
 *   - `AuthService.currentUser()`: `Signal<CurrentUser | null>`
 *   - `AuthStore.roles() / permissions() / bypass() / tenantId()`: signal state
 *     populated by `AuthStore.hydrate()` (Phase 1.2.2).
 *   - Guards (`authGuard`, `permissionGuard`, `roleGuard`) + structural
 *     directives (`*appHasPermission`, `*appHasRole`) read these signals.
 */

/**
 * Projection of `@azure/msal-browser`'s `AccountInfo` plus a few id-token claims
 * we care about. MSAL's type is wider; keeping our own narrow shape means:
 *
 *   - Template bindings have stable, obvious properties (`displayName`, `email`);
 *   - A future BFF cookie-mode swap (U1 hybrid path) can populate this same
 *     shape from a `/me` call without touching MSAL at all.
 */
export interface CurrentUser {
  /** OID claim — stable Azure AD object id. */
  readonly id: string;

  /** Full display name (`name` claim / MSAL `AccountInfo.name`). */
  readonly displayName: string;

  /** Primary email / UPN (`preferred_username` / MSAL `AccountInfo.username`). */
  readonly email: string;

  /** Azure AD tenant id (`tid` claim). May differ from the platform tenant id. */
  readonly aadTenantId: string;
}

/**
 * Response shape of `GET /api/v1/me/permissions`.
 *
 * The backend returns the effective set after resolving role assignments,
 * group memberships, and tenant-scoped overrides. The client trusts this
 * set for UI gating but **never** for security-critical decisions — the API
 * re-checks every write authoritatively.
 */
export interface EffectivePermissions {
  /**
   * Coarse role labels the user has (e.g. `'admin'`, `'manager'`). Mirror of
   * what's in the id-token `roles` claim; included here so UI logic can read a
   * single source of truth rather than parsing the JWT again.
   */
  readonly roles: readonly string[];

  /**
   * Fine-grained permission strings (e.g. `'users:read'`, `'reports:export'`).
   * The convention is `<resource>:<action>`; `<resource>.<qualifier>:<action>`
   * is allowed for qualified resources. Strings are compared case-insensitively.
   */
  readonly permissions: readonly string[];

  /**
   * Platform-level tenant id this user is currently scoped to (distinct from
   * the AAD `tid`). Flows into the `X-Tenant-ID` header via `tenantInterceptor`.
   * `null` for super-admins or unscoped identities.
   */
  readonly tenantId: string | null;

  /**
   * Server-granted bypass — when `true`, permission checks short-circuit to
   * allow. Replaces the old `'super:admin'` magic-string convention; explicit,
   * auditable, revocable without a client release.
   */
  readonly bypass: boolean;

  /**
   * Server-provided TTL (seconds) for this hydrated set. When it expires the
   * client re-hydrates on next permission check. Optional — default is
   * 5 minutes if omitted.
   */
  readonly ttlSeconds?: number;
}
