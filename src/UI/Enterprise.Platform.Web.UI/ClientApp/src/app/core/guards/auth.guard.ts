/**
 * ─── AUTH GUARD (functional) ────────────────────────────────────────────────────
 *
 * WHY
 *   Every protected route needs a single, consistent answer to "is this user
 *   allowed to see this URL?". `authGuard` answers the narrow first question:
 *   is ANYONE signed in right now? Fine-grained authorization (permissions,
 *   roles, resource ownership) is delegated to the specialized guards that
 *   compose after it.
 *
 * WHAT IT DOES
 *   1. Reads `AuthService.isAuthenticated()`.
 *   2. If `true` → allow activation.
 *   3. If `false` → redirect to `/auth/login`, carrying the attempted URL as
 *      a `returnUrl` query param so the user lands where they were going
 *      after sign-in.
 *
 * WHY FUNCTIONAL (not class-based)
 *   Angular 16+ functional guards are lighter: no decorator, no `providedIn`,
 *   DI via `inject()`. They compose neatly in route configs:
 *     `canActivate: [authGuard, permissionGuard('users.read')]`
 *
 * HOW TO USE
 *   ```ts
 *   {
 *     path: 'users',
 *     canActivate: [authGuard],
 *     loadChildren: () => import('./features/users/users.routes')
 *       .then(m => m.USERS_ROUTES),
 *   }
 *   ```
 *   Typically combined with `permissionGuard(...)` for fine-grained checks.
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Not authenticated → redirect to login, preserving the attempted URL so
  // the user can continue after signing in. `createUrlTree` returns a
  // UrlTree that Angular honours as a navigation-redirect.
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
