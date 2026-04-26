/**
 * ─── AUTH MODELS ────────────────────────────────────────────────────────────────
 *
 * WHY
 *   Two distinct things the auth layer deals with:
 *
 *     1. `CurrentUser` — what the UI displays in headers, avatars, greetings.
 *        Projected from the BFF's `/api/auth/session` response (Phase 9).
 *
 *     2. `EffectivePermissions` — authoritative authorization decisions.
 *        Fetched from `GET /me/permissions` (via the BFF proxy) after login.
 *        Never derived from token claims client-side — the SPA doesn't see
 *        tokens at all in the Phase-9 topology; even if it did, role/group
 *        claims are coarse labels, not fine-grained permission strings.
 *
 * WHY SEPARATE
 *   The current user is a public UX concern (signal any template can bind to).
 *   Permissions are a guarded authorization concern — their hydration is
 *   side-effect-producing and can fail (network, 401). Separating the types
 *   prevents accidental coupling (e.g. "show user menu only when permissions
 *   loaded" would be a bug — show the menu as soon as the session resolves).
 *
 * HOW IT'S USED
 *   - `AuthService.currentUser()`: `Signal<CurrentUser | null>`
 *   - `AuthStore.roles() / permissions() / bypass() / tenantId()`: signal state
 *     populated by `AuthStore.hydrate()`.
 *   - Guards (`authGuard`, `permissionGuard`, `roleGuard`) + structural
 *     directives (`*appHasPermission`, `*appHasRole`) read these signals.
 */

/**
 * Projection of the BFF's `/api/auth/session` response. Keeping our own
 * narrow shape means template bindings have stable, obvious properties
 * (`displayName`, `email`).
 *
 * Anything deeper (user id, tenant id, role breakdowns) lives in the
 * hydrated `AuthStore` state — the SPA deliberately doesn't need Entra's
 * `oid` / `tid` claims to render chrome.
 */
export interface CurrentUser {
  /** Full display name (BFF's `name` claim projection). */
  readonly displayName: string;

  /** Primary email / UPN (BFF tries `email` → `preferred_username` → schema claim). */
  readonly email: string;
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
