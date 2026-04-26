/**
 * ─── USERS — FEATURE ROUTES ─────────────────────────────────────────────────────
 *
 * Lazy-loaded child routes for `/users`. The `UsersStore` is provided at the
 * route level so it's instantiated when the user navigates in and disposed
 * when they navigate away — keeps the user-list cache from outliving its
 * relevance, and makes vitest setup straightforward (each test scope gets a
 * fresh store).
 *
 * Route metadata (`data: RouteMetadata`) drives the sidebar / breadcrumbs.
 */
import type { Routes } from '@angular/router';

import type { RouteMetadata } from '@core/models';

import { UsersStore } from './state/users.store';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [UsersStore],
    children: [
      {
        path: '',
        title: 'Users',
        data: {
          label: 'Users',
          // No breadcrumb here — the parent /users route already declares it.
          // Adding it again would duplicate "Users" in the trail.
          showInNav: false,           // parent route in app.routes.ts owns nav metadata
          pageHeader: {
            title: 'Users',
            subtitle: 'Browse and manage platform users.',
            icon: 'pi pi-users',
            primaryAction: {
              label: 'New user',
              icon: 'pi pi-plus',
              actionKey: 'users.create',
            },
          },
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/users-list.component').then((m) => m.UsersListComponent),
      },
      {
        path: 'new',
        title: 'New user',
        data: {
          breadcrumb: 'New',
          showInNav: false,
          pageHeader: {
            title: 'Create user',
            subtitle: 'Provision a new account.',
            icon: 'pi pi-user-plus',
            backRoute: '/users',
          },
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/user-create.component').then((m) => m.UserCreateComponent),
      },
      {
        path: ':id',
        title: 'User detail',
        data: {
          /* Dynamic breadcrumb — uses the route param if no resolver fed
           * the entity name in. The user-detail page can override this
           * with `BreadcrumbService` once it has the real display name. */
          breadcrumb: (params: Readonly<Record<string, string>>) =>
            params['id'] ?? 'Detail',
          showInNav: false,
          /* Page-header is intentionally omitted — the user-detail page
           * sets it dynamically via PageHeaderService once the entity is
           * loaded (title = "Jane Doe", badge = role, primary action =
           * "Edit"). Static defaults would flash stale data. */
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/user-detail.component').then((m) => m.UserDetailComponent),
      },
    ],
  },
];

/** Default export so `loadChildren` can use `() => import(...).then((m) => m.default)`. */
export default USERS_ROUTES;
