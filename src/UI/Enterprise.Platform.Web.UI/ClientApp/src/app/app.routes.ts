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
        data: {
          label: 'Dashboard',
          icon: 'pi-home',
          breadcrumb: 'Dashboard',
          showInNav: true,
        } satisfies RouteMetadata,
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
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
