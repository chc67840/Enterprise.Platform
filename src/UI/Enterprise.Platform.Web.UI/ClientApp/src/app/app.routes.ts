/**
 * ─── APPLICATION ROUTES ─────────────────────────────────────────────────────────
 *
 * Shape (Architecture §5.2):
 *
 *   /auth          — AuthLayout
 *     /login       — LoginComponent (public)
 *
 *   /              — AppShell (canActivate: [authGuard])
 *     /dashboard   — DashboardComponent (Phase 1 placeholder; Phase 12 real KPIs)
 *     /settings    — (Phase 12)
 *     /users       — (Phase 12 — loadChildren into USERS_ROUTES)
 *
 *   /error         — ErrorLayout
 *     /forbidden   — 403
 *     /server-error
 *     /offline
 *     /maintenance
 *
 *   **             — 404 (NotFoundComponent)
 *
 * RULES
 *   1. Every feature route is lazy-loaded via `loadComponent` / `loadChildren`.
 *   2. Protected routes live under `/` with `canActivate: [authGuard]` at the
 *      layout level — children inherit.
 *   3. Compound guards stack: `[authGuard, permissionGuard('users:read')]`.
 *   4. The 404 catch-all is the LAST route.
 *   5. Route metadata (label, icon, requiredPermissions, featureFlag) lives
 *      in each route's `data: { ... } satisfies RouteMetadata`. Sidebar nav
 *      + breadcrumbs (Phase 5) consume this metadata.
 */
import type { Routes } from '@angular/router';

import { authGuard } from '@core/guards/auth.guard';
import type { RouteMetadata } from '@core/models';

export const routes: Routes = [
  // ── PUBLIC ──────────────────────────────────────────────────────────────
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        title: 'Sign in',
        loadComponent: () =>
          import('./features/auth/components/login.component').then((m) => m.LoginComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },

  // ── PROTECTED — under AppShell ──────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        // Phase 7.1 — `preload: true` is the CustomPreloader's opt-in flag.
        // Dashboard is the default landing after sign-in, so pre-fetching
        // its chunk while the user is still on /auth/login shaves perceived
        // load time. Respects `navigator.connection.saveData`.
        data: {
          label: 'Dashboard',
          icon: 'pi-home',
          breadcrumb: 'Dashboard',
          showInNav: true,
          preload: true,
          pageHeader: {
            title: 'Dashboard',
            subtitle: 'Phase 1 scaffold — stabilization complete.',
            icon: 'pi pi-home',
          },
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      // ⚠ TEMPORARY DEMO — see src/app/features/__demo/sub-nav-demo.component.ts header for removal checklist.
      {
        path: 'demo/sub-nav',
        title: 'Sub-Nav Demo',
        loadChildren: () =>
          import('./features/__demo/sub-nav-demo.routes').then((m) => m.SUB_NAV_DEMO_ROUTES),
      },
      // PERMANENT — UI Kit reference (replaces Storybook). 14 component categories, all variants.
      {
        path: 'demo/ui-kit',
        title: 'UI Kit',
        loadChildren: () =>
          import('./features/__demo/ui-kit/ui-kit.routes').then((m) => m.UI_KIT_ROUTES),
      },
      {
        path: 'users',
        // Phase D — first concrete feature against the db-first /api/v1/users
        // endpoints. UsersStore is provided inside USERS_ROUTES so its lifecycle
        // tracks navigation in/out of the feature.
        data: {
          label: 'Users',
          icon: 'pi-users',
          breadcrumb: 'Users',
          showInNav: true,
        } satisfies RouteMetadata,
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // 404 inside the shell — keeps the master nav + footer visible so users
      // recover via the chrome (nav back to a real route, click the logo, etc.).
      // Sits last so explicit child routes always match first. The top-level
      // catch-all below remains as a fallback for non-shell paths (auth/error
      // sub-trees that don't match any of their declared children).
      //
      // pageHeader is declared so the SubNavOrchestrator owns the <h1> +
      // gives proper breathing room between navbar and content. Without it
      // the orchestrator renders an empty 0px container and the card slams
      // up against the navbar.
      {
        path: '**',
        title: 'Page not found',
        data: {
          pageHeader: {
            title: 'Page not found',
            subtitle: 'The URL you followed does not match any route in this app.',
            icon: 'pi pi-question-circle',
            primaryAction: {
              label: 'Return home',
              icon: 'pi pi-home',
              actionKey: 'nav.home',
            },
          },
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./features/error-pages/not-found/not-found.component').then(
            (m) => m.NotFoundComponent,
          ),
      },
    ],
  },

  // ── ERROR PAGES — under ErrorLayout ─────────────────────────────────────
  {
    path: 'error',
    loadComponent: () =>
      import('./layouts/error-layout/error-layout.component').then((m) => m.ErrorLayoutComponent),
    children: [
      {
        path: 'forbidden',
        title: 'Access denied',
        loadComponent: () =>
          import('./features/error-pages/forbidden/forbidden.component').then(
            (m) => m.ForbiddenComponent,
          ),
      },
      {
        path: 'server-error',
        title: 'Server error',
        loadComponent: () =>
          import('./features/error-pages/server-error/server-error.component').then(
            (m) => m.ServerErrorComponent,
          ),
      },
      {
        path: 'offline',
        title: 'Offline',
        loadComponent: () =>
          import('./features/error-pages/offline/offline.component').then((m) => m.OfflineComponent),
      },
      {
        path: 'maintenance',
        title: 'Maintenance',
        loadComponent: () =>
          import('./features/error-pages/maintenance/maintenance.component').then(
            (m) => m.MaintenanceComponent,
          ),
      },
    ],
  },

  // ── 404 CATCH-ALL (must be last) ────────────────────────────────────────
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () =>
      import('./features/error-pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
