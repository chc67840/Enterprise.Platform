/**
 * ─── ROUTE METADATA ─────────────────────────────────────────────────────────────
 *
 * WHY
 *   Angular's `Route.data` is `{[key: string]: any}` — a weak type. By pinning
 *   a `RouteMetadata` shape we can:
 *
 *     1. Build the sidebar / command palette from the route tree instead of
 *        maintaining a separate nav structure that drifts from routes.
 *     2. Let the `breadcrumbResolver` (Phase 5.2 — target) walk routes and emit
 *        `BreadcrumbItem[]` without each feature re-defining the shape.
 *     3. Centralize feature-flag gating and required-permissions declarations
 *        so a single `data` object drives both navigation visibility and route
 *        activation.
 *
 * USAGE
 *   ```ts
 *   {
 *     path: 'users',
 *     data: {
 *       label: 'Users',
 *       icon: 'pi-users',
 *       breadcrumb: 'Users',
 *       requiredPermissions: ['users:read'],
 *       featureFlag: 'users.enabled',
 *       showInNav: true,
 *     } satisfies RouteMetadata,
 *     canActivate: [authGuard, permissionGuard('users:read')],
 *     loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES),
 *   }
 *   ```
 *
 *   The `satisfies` keyword gives type-checking without widening the inferred
 *   type of `data` — so `route.data['label']` remains strongly typed downstream.
 */
export interface RouteMetadata {
  /** Human-readable label — shown in sidebar, tabs, command palette. */
  readonly label?: string;

  /** PrimeIcons class (e.g. `'pi-users'`) — rendered as sidebar icon. */
  readonly icon?: string;

  /**
   * Breadcrumb text — static string or `(params) => string` for dynamic text
   * built from route params. Consumed by a future `breadcrumbResolver`.
   */
  readonly breadcrumb?: string | ((params: Readonly<Record<string, string>>) => string);

  /**
   * Permissions required to mount this route. AND semantics — all must be
   * present. The `permissionGuard` reads this (as a fallback when not supplied
   * as a direct argument to the factory).
   */
  readonly requiredPermissions?: readonly string[];

  /**
   * Roles that may access this route. OR semantics — any one grants access.
   */
  readonly requiredRoles?: readonly string[];

  /**
   * Runtime feature-flag key (matches a key in the `FeatureFlagService`).
   * `featureFlagGuard(flag)` reads this to gate route activation.
   */
  readonly featureFlag?: string;

  /**
   * Whether this route should appear in the sidebar nav. Routes with children
   * (groupings) set this on the parent; leaf routes default `true`.
   */
  readonly showInNav?: boolean;

  /**
   * Nav grouping — sidebar renders each `group` as a section. Unset = default
   * section. Example values: `'platform'`, `'admin'`, `'support'`.
   */
  readonly group?: string;

  /**
   * Preload hint. `CustomPreloader` (Phase 7.1) preloads routes flagged `true`
   * once the initial navigation is idle.
   */
  readonly preload?: boolean;
}
