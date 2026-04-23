/**
 * ─── MENU CONFIG SERVICE ───────────────────────────────────────────────────────
 *
 * WHY
 *   The nav variants render whatever this service exposes — they don't know
 *   (or care) where the menu came from. Today the menu is a hard-coded
 *   constant; tomorrow the BFF will return it per-user from
 *   `GET /api/v1/me/navigation`. Variants don't need to change for that swap.
 *
 *   Exposing the menu as a `Signal<readonly NavMenuItem[]>` makes the data
 *   flow play nicely with PrimeNG's `[model]` input + Angular's zoneless
 *   change detection — re-renders only happen when the menu actually changes.
 *
 * WHY a service (not a constant import)
 *   - Authorization: the eventual filtering logic ("hide items the user
 *     can't see") needs `AuthStore` access — that pulls us into DI anyway.
 *   - Tenant overrides: future tenants will want to suppress / add nav items
 *     without forking a constants file.
 *   - Testability: variants can be tested with a stub MenuConfigService that
 *     emits a curated tree.
 *
 * SHAPE OF THE FUTURE BFF CONTRACT
 *   The `MOCK_MENU` constant below is the canonical shape — when the BFF
 *   endpoint ships, the only change here is replacing the constructor's
 *   constant write with an HTTP call.
 */
import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthStore } from '@core/auth';

import type { NavMenuItem } from './nav-menu.types';

/**
 * Mock data — wire-shaped exactly like the future BFF response. Keep this in
 * sync with `Enterprise.Platform.Application.Features.Navigation.GetMyNavigation`
 * (when it lands) so the swap is a one-liner.
 *
 * Items are intentionally sparse for Phase-1 — the dashboard route is the
 * only thing actually mounted. Add items as features ship.
 */
const MOCK_MENU: readonly NavMenuItem[] = [
  {
    id: 'dashboard',
    kind: 'link',
    label: 'Dashboard',
    icon: 'pi pi-home',
    routerLink: '/dashboard',
  },
  {
    id: 'workspace',
    kind: 'group',
    label: 'Workspace',
    icon: 'pi pi-th-large',
    children: [
      {
        id: 'workspace.tasks',
        kind: 'link',
        label: 'Tasks',
        icon: 'pi pi-check-square',
        routerLink: '/workspace/tasks',
        badge: 3,
        badgeSeverity: 'info',
      },
      {
        id: 'workspace.calendar',
        kind: 'link',
        label: 'Calendar',
        icon: 'pi pi-calendar',
        routerLink: '/workspace/calendar',
      },
      {
        id: 'workspace.documents',
        kind: 'link',
        label: 'Documents',
        icon: 'pi pi-folder',
        routerLink: '/workspace/documents',
      },
    ],
  },
  {
    id: 'people',
    kind: 'group',
    label: 'People',
    icon: 'pi pi-users',
    requiredPermissions: ['users:read'],
    children: [
      {
        id: 'people.users',
        kind: 'link',
        label: 'Users',
        icon: 'pi pi-user',
        routerLink: '/users',
        requiredPermissions: ['users:read'],
      },
      {
        id: 'people.teams',
        kind: 'link',
        label: 'Teams',
        icon: 'pi pi-users',
        routerLink: '/teams',
        requiredPermissions: ['teams:read'],
      },
      {
        id: 'people.roles',
        kind: 'link',
        label: 'Roles & permissions',
        icon: 'pi pi-shield',
        routerLink: '/roles',
        requiredPermissions: ['roles:read'],
      },
    ],
  },
  {
    id: 'reports',
    kind: 'group',
    label: 'Reports',
    icon: 'pi pi-chart-bar',
    children: [
      {
        id: 'reports.overview',
        kind: 'link',
        label: 'Overview',
        icon: 'pi pi-chart-line',
        routerLink: '/reports/overview',
      },
      {
        id: 'reports.audit',
        kind: 'link',
        label: 'Audit log',
        icon: 'pi pi-list',
        routerLink: '/reports/audit',
        requiredPermissions: ['audit:read'],
      },
    ],
  },
  {
    id: 'settings',
    kind: 'link',
    label: 'Settings',
    icon: 'pi pi-cog',
    routerLink: '/settings',
  },
] as const;

@Injectable({ providedIn: 'root' })
export class MenuConfigService {
  private readonly auth = inject(AuthStore);

  /**
   * Source-of-truth raw menu. Today it's the mock constant; tomorrow this
   * signal gets `set()` by an HTTP response handler. Either way, downstream
   * `items()` recomputes automatically.
   */
  private readonly _source = signal<readonly NavMenuItem[]>(MOCK_MENU);

  /**
   * Authorization-filtered menu the variants actually render.
   *
   * Filtering is done client-side as a UX-only hint — the API still enforces
   * permissions on every call, so a tampered client menu can't grant access.
   * The recursion is bounded by tree depth (<= 3 in practice) so the cost
   * stays negligible compared to PrimeNG's render.
   */
  readonly items = computed<readonly NavMenuItem[]>(() => this.filter(this._source()));

  /**
   * Manually override the menu source. Future BFF integration will call this
   * from the response handler. Tests use this to inject curated trees.
   */
  setMenu(items: readonly NavMenuItem[]): void {
    this._source.set(items);
  }

  /** Snapshot for debugging / non-reactive consumers. */
  snapshot(): readonly NavMenuItem[] {
    return this.items();
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  private filter(items: readonly NavMenuItem[]): NavMenuItem[] {
    return items
      .filter((item) => this.isAllowed(item))
      .map((item) => {
        if (item.kind === 'group' && item.children?.length) {
          const filteredChildren = this.filter(item.children);
          // Drop empty groups so the chrome doesn't show a parent that opens
          // an empty submenu.
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is NavMenuItem => item !== null);
  }

  private isAllowed(item: NavMenuItem): boolean {
    const perms = item.requiredPermissions ?? [];
    if (perms.length > 0 && !this.auth.hasAnyPermission(...perms)) return false;

    const roles = item.requiredRoles ?? [];
    if (roles.length > 0 && !this.auth.hasAnyRole(...roles)) return false;

    // featureFlag resolution lives outside the permission store; until
    // FeatureFlagService is available client-side (Phase 8), treat the field
    // as "no gate" — server-side gating still applies on the API call.
    return true;
  }
}
