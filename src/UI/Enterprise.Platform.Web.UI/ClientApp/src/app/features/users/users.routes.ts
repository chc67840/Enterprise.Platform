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
 *
 * Guards:
 *   - `permissionGuard('users.read')` on list + detail (hidden from nav too if
 *     the user lacks the permission — the navbar config provider filters server-
 *     side; this guard is the defense-in-depth client-side check).
 *   - `permissionGuard('users.create')` on /new (the "New user" CTA in the page
 *     header is also gated by the same key in the list component template).
 *
 * The `authGuard` covering all protected routes is applied by the parent
 * `app.routes.ts` AppShell route, so it isn't repeated here.
 *
 * `canDeactivate` (unsaved-changes prompt) is wired on the create + detail
 * routes via the inline `unsavedChangesGuard` factory — components implement
 * the `HasUnsavedChanges` interface to opt in.
 */
import type { CanDeactivateFn, Routes } from '@angular/router';

import { permissionGuard } from '@core/guards/permission.guard';
import type { RouteMetadata } from '@core/models';

import { USER_PERMISSIONS } from './data/user.permissions';
import { UsersStore } from './state/users.store';

/**
 * Marker interface — components that own a dirty form expose `canDeactivate()`
 * and the inline guard below dispatches to it.
 */
export interface HasUnsavedChanges {
  canDeactivate(): boolean | Promise<boolean>;
}

/**
 * Generic "are you sure?" guard for forms with unsaved changes. Components
 * implementing `HasUnsavedChanges` get a confirm() prompt before navigation;
 * components that don't are unaffected.
 *
 * Why factory-style instead of factoring into core/guards: this guard is
 * trivial, only used by the users feature today, and `canDeactivate` is a
 * stricter contract than the existing core guards (mostly auth/permission).
 */
const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  return component?.canDeactivate ? component.canDeactivate() : true;
};

export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [UsersStore],
    canActivate: [permissionGuard(USER_PERMISSIONS.READ)],
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
              // Permission key is consumed by the page-header component to
              // hide the CTA when the user lacks `users.create`.
              requiredPermissions: [USER_PERMISSIONS.CREATE],
            },
          },
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/users-list.component').then((m) => m.UsersListComponent),
      },
      {
        path: 'new',
        title: 'New user',
        canActivate: [permissionGuard(USER_PERMISSIONS.CREATE)],
        canDeactivate: [unsavedChangesGuard],
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
        canDeactivate: [unsavedChangesGuard],
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
