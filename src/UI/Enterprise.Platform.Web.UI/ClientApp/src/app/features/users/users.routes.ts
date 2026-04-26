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
          breadcrumb: 'Users',
          showInNav: false,           // parent route in app.routes.ts owns nav metadata
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
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/user-create.component').then((m) => m.UserCreateComponent),
      },
      {
        path: ':id',
        title: 'User detail',
        data: {
          breadcrumb: 'Detail',
          showInNav: false,
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/user-detail.component').then((m) => m.UserDetailComponent),
      },
    ],
  },
];

/** Default export so `loadChildren` can use `() => import(...).then((m) => m.default)`. */
export default USERS_ROUTES;
