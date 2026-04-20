/**
 * ─── PERMISSION GUARD (factory → functional) ────────────────────────────────────
 *
 * WHY
 *   Routes need fine-grained access control expressed in human-readable
 *   permission strings (`users:read`, `reports:export`). This guard checks
 *   the hydrated permission set in `AuthStore` — NOT the raw id-token roles.
 *
 *   The distinction matters: id-token `roles` are coarse labels assigned in
 *   Azure AD; permissions are the effective set the backend would enforce
 *   on the matching endpoint. Using `AuthStore.permissions()` keeps the UI
 *   gating in sync with what the API will actually allow.
 *
 * TWO SEMANTICS
 *   - `permissionGuard('a', 'b')` → **AND** — user must have every listed permission.
 *   - `anyPermissionGuard('a', 'b')` → **OR** — user must have at least one.
 *
 *   AND is the default because most route actions map to a single permission;
 *   compound requirements are rare and better expressed explicitly as AND.
 *
 * HYDRATION SAFETY
 *   If the permission set is stale or never loaded, the guard waits for
 *   `hydrate()` to resolve — but hydration itself happens automatically on
 *   login (`AuthService.triggerHydrationOnLogin`), so by the time a protected
 *   route is mounted, permissions should already be loaded.
 *
 *   If hydration has failed (network error etc.), the guard fails CLOSED:
 *   deny access, redirect to `/error/forbidden`. A "try again" affordance
 *   on the forbidden page can retrigger hydration.
 *
 * HOW TO USE
 *   ```ts
 *   canActivate: [authGuard, permissionGuard('users:read')]
 *   canActivate: [authGuard, permissionGuard('users:update', 'users:delete')]  // AND
 *   canActivate: [authGuard, anyPermissionGuard('reports:read', 'reports:export')]  // OR
 *   ```
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '@core/auth/auth.store';

/**
 * AND-semantics permission guard. All listed permissions must be present.
 *
 * @param requiredPermissions one or more permission strings
 * @returns a `CanActivateFn` suitable for use in `Route.canActivate`
 */
export function permissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);

    // If nothing is required, allow. Defensive — callers shouldn't invoke it
    // empty, but better to open than close when the config is ambiguous.
    if (requiredPermissions.length === 0) return true;

    const allowed = store.hasAllPermissions(...requiredPermissions);
    return allowed ? true : router.createUrlTree(['/error/forbidden']);
  };
}

/**
 * OR-semantics permission guard. At least one listed permission must be present.
 */
export function anyPermissionGuard(...requiredPermissions: string[]): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);

    if (requiredPermissions.length === 0) return true;

    const allowed = store.hasAnyPermission(...requiredPermissions);
    return allowed ? true : router.createUrlTree(['/error/forbidden']);
  };
}
