# 07 — Routes File

`<feature>.routes.ts` is the feature's only public surface. It exports a `Routes` array consumed by `loadChildren` in `app.routes.ts`.

## Anatomy — full Users example

```ts
// features/users/users.routes.ts
import type { Routes } from '@angular/router';
import type { RouteMetadata } from '@core/models';

import { UsersStore } from './state/users.store';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [UsersStore],          // ← per-feature store provider
    children: [
      {
        path: '',
        title: 'Users',
        data: {
          label: 'Users',
          showInNav: false,
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
          breadcrumb: (params: Readonly<Record<string, string>>) => params['id'] ?? 'Detail',
          showInNav: false,
          // pageHeader intentionally omitted — page sets it dynamically once entity loads
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./views/user-detail.component').then((m) => m.UserDetailComponent),
      },
    ],
  },
];

export default USERS_ROUTES;
```

## Decisions

### Wrapping `path: ''` parent route

Notice the OUTER route is `path: ''` with `providers: [UsersStore]` and child routes nested inside. This pattern lets the store be provided ONCE for all children (`/users`, `/users/new`, `/users/:id`) — they share the same store instance.

If you put `providers: [UsersStore]` on each child, they'd each get a separate instance and the cache wouldn't carry across navigation. Always nest under a `path: ''` parent when the children share state.

### `loadComponent` per leaf route

Every leaf route uses `loadComponent: () => import(...)`. Each component becomes its own lazy chunk. The list view loads when the user navigates to `/users`; the detail view downloads only when they click into a row.

For multi-component features that always load together, you can `loadChildren: () => import(...)` to a sub-routes file, but at our scale `loadComponent` per view is simpler.

### `data: { ... } satisfies RouteMetadata`

Every route declares typed metadata. Schema:

```ts
// core/models/route-metadata.model.ts (excerpt)
interface RouteMetadata {
  readonly label?: string;                          // sidebar / command palette
  readonly icon?: string;                           // PrimeIcons class
  readonly breadcrumb?: string | ((params) => string);  // BreadcrumbService input
  readonly requiredPermissions?: readonly string[]; // permissionGuard input
  readonly requiredRoles?: readonly string[];
  readonly featureFlag?: string;                    // FeatureFlagGuard (future)
  readonly showInNav?: boolean;                     // sidebar visibility
  readonly group?: string;
  readonly preload?: boolean;                       // CustomPreloader opt-in
  readonly pageHeader?: PageHeaderConfig;           // SubNavOrchestrator
}
```

The `satisfies` keyword type-checks the declaration without widening the inferred type — useful when the rest of the app reads specific fields (like `data['pageHeader']`).

### Dynamic breadcrumb

```ts
breadcrumb: (params) => params['id'] ?? 'Detail'
```

When the breadcrumb depends on the URL (entity id, slug, etc.), use the function form. `BreadcrumbService` calls it with the route's `params` snapshot. For dynamic labels sourced from API data (`Jane Doe` instead of `123`), the page can override at runtime — but the route data form is what the breadcrumb shows during the lazy-load window before the entity arrives.

### Static `pageHeader` vs dynamic page-set

For pages where the title is known at route declaration time (list page, create page), declare in `data.pageHeader`. The orchestrator picks it up automatically.

For pages where the title depends on resolved data (detail page showing entity name), OMIT `pageHeader` from route data and call `PageHeaderService.set(...)` from the page component once the entity loads. Otherwise users see "User detail" flash before "Jane Doe" replaces it. See `06-view-layer.md`.

### Guards — `canActivate`

Add guards at the leaf or parent level. Multiple guards stack with AND semantics:

```ts
canActivate: [authGuard, permissionGuard('users:read')]
```

If a guard fails, the user is redirected per the guard's UrlTree return. See `08`.

For Users today, no per-route `canActivate` — `authGuard` lives on the shell parent route in `app.routes.ts`, so all shell-children inherit. When permission gating becomes feature-specific (e.g. only admins can see `/users/:id/edit`), add it on that specific child:

```ts
{
  path: ':id/edit',
  canActivate: [permissionGuard('users:update')],
  loadComponent: () => import('./views/user-edit.component').then(m => m.UserEditComponent),
}
```

### Resolvers — almost never

Resolvers (`resolve: { user: userResolver }`) block navigation until data loads. They guarantee the page renders with data already present, no skeleton needed.

Tradeoff: while the resolver runs, the user sees the OLD page or a blank screen — depending on how Angular's view transition is configured. For most pages this is worse UX than rendering a skeleton.

**Default: don't use resolvers.** Let pages render immediately with skeletons (see `09`). Use resolvers only for pages where rendering empty fields would be misleading (a printable invoice that shouldn't appear with `Loading...` placeholders mid-render).

### Wiring into `app.routes.ts`

```ts
// app.routes.ts (excerpt)
{
  path: '',
  loadComponent: () => import('./layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
  canActivate: [authGuard],
  children: [
    { path: 'dashboard', /* ... */ },
    {
      path: 'users',
      data: {
        label: 'Users',
        icon: 'pi-users',
        breadcrumb: 'Users',
        showInNav: true,
      } satisfies RouteMetadata,
      loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
    },
    // ... other features
  ],
}
```

The parent `path: 'users'` declares the BREADCRUMB and NAV-VISIBILITY metadata. The child routes (inside USERS_ROUTES) declare the per-view `pageHeader` and any leaf-specific overrides.

## Naming convention

Export name is SCREAMING_SNAKE_CASE + `_ROUTES` suffix: `USERS_ROUTES`, `BILLING_ROUTES`, `ADMIN_AUDIT_ROUTES`.

A `default` export pointing to the same array is a courtesy for `import('./x.routes').then(m => m.default)` style — kept for parity with feature folders that use both forms.

## Optional extensions

- **`runGuardsAndResolvers: 'always'`** — re-run guards on every navigation, including same-URL nav. Useful when permissions can change mid-session.
- **`canDeactivate: [unsavedChangesGuard]`** — prevents navigation away from a dirty form. We have `unsaved-changes.guard.ts` ready in `core/guards/`.
- **Children with `path: ''` redirect to a default child** — `{ path: '', pathMatch: 'full', redirectTo: 'list' }` if `/users` should redirect to `/users/list`.
