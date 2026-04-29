/**
 * ─── USER FEATURE — PERMISSION KEYS ─────────────────────────────────────────────
 *
 * Single source of truth for permission strings used by the users feature.
 * Both route guards and template-level `AuthStore.hasAllPermissions(...)` calls
 * import from here so a typo in either side is caught at build time, not at
 * "why doesn't my menu item show up" debugging time.
 *
 * Naming convention: `<aggregate>:<action>` lower-case, colon-separated. Mirrors
 * the backend `[Authorize(Policy = "users:read")]` strings emitted by the API's
 * `IPermissionPolicyProvider` (see `Enterprise.Platform.Api/Authorization/`).
 *
 * Action vocabulary:
 *   - `read`        — list + detail view
 *   - `create`      — POST /users (create a new account)
 *   - `write`       — rename, change email (mutate existing fields)
 *   - `deactivate`  — POST /users/{id}/deactivate (suspends sign-in)
 *   - `activate`    — POST /users/{id}/activate (restores sign-in)
 *
 * `deactivate` and `activate` are split rather than collapsed under `write`
 * because the audit + compliance posture treats activation-state changes as a
 * distinct privileged action (HIPAA/SOX both require separate auth scope for
 * "can suspend a user's access").
 */

export const USER_PERMISSIONS = {
  READ: 'users:read',
  CREATE: 'users:create',
  WRITE: 'users:write',
  DEACTIVATE: 'users:deactivate',
  ACTIVATE: 'users:activate',
} as const;

export type UserPermissionKey = (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];
