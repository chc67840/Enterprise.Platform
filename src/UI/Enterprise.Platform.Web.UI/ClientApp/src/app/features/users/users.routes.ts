/**
 * ─── USERS — FEATURE ROUTES ─────────────────────────────────────────────────────
 *
 * Lazy-loaded child routes for `/users`. Single route now: the list view
 * owns CRUD via dialogs (create + edit + deactivate-with-reason), so the
 * prior `/users/new` and `/users/:id` routes were retired in favour of
 * modal flows. The `UsersStore` is provided at this level so it's
 * instantiated when the user navigates in and disposed when they leave.
 *
 * Guards:
 *   - `permissionGuard('users.read')` — hidden from nav and blocked by
 *     the route guard for users without `users.read`. The "New user" CTA
 *     in the list page additionally checks `users.create`; the API
 *     `[Authorize(Policy = "perm:users.create")]` is the back-stop.
 *
 * The `authGuard` covering all protected routes is applied by the parent
 * `app.routes.ts` AppShell route, so it isn't repeated here.
 */
import type { Routes } from '@angular/router';

import { permissionGuard } from '@core/guards/permission.guard';
import type { RouteMetadata } from '@core/models';

import { USER_PERMISSIONS } from './data/user.permissions';
import { UsersStore } from './state/users.store';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [UsersStore],
    canActivate: [permissionGuard(USER_PERMISSIONS.READ)],
    title: 'Users',
    data: {
      label: 'Users',
      showInNav: false,
      pageHeader: {
        title: 'Users',
        subtitle: 'Browse and manage platform users.',
        icon: 'pi pi-users',
      },
    } satisfies RouteMetadata,
    loadComponent: () =>
      import('./views/users-list.component').then((m) => m.UsersListComponent),
  },
];

export default USERS_ROUTES;
