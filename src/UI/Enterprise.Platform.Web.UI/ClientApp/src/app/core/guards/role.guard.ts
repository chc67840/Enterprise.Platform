/**
 * ─── ROLE GUARD (factory → functional) ──────────────────────────────────────────
 *
 * WHY
 *   Some routes gate on the coarser concept of role membership (e.g. "admin"
 *   can see the audit log, "manager" can see their team's reports). Roles are
 *   a subset check distinct from fine-grained permissions:
 *
 *     - `permissionGuard('reports:read')` → can the user perform this action?
 *     - `roleGuard('admin')` → is the user in this role?
 *
 *   Keep both guards because they communicate intent. Use `permissionGuard`
 *   by default; reach for `roleGuard` only when the UX affordance is tied to
 *   a role concept the user recognises (e.g. "Admin Tools").
 *
 * SEMANTICS
 *   OR across roles (user may be in any of the listed roles to pass). This
 *   matches the common case ("allow admins OR managers").
 *
 *   `bypass` does NOT grant roles — bypass users get to perform any permission
 *   check, but the UI may still conditionally render role-based affordances
 *   that don't make sense for them.
 *
 * HOW TO USE
 *   ```ts
 *   canActivate: [authGuard, roleGuard('admin')]
 *   canActivate: [authGuard, roleGuard('admin', 'manager')]  // OR
 *   ```
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '@core/auth/auth.store';

export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);

    if (allowedRoles.length === 0) return true;

    const allowed = store.hasAnyRole(...allowedRoles);
    return allowed ? true : router.createUrlTree(['/error/forbidden']);
  };
}
