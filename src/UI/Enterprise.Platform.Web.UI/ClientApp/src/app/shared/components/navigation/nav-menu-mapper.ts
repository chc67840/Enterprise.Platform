/**
 * ─── NAV MENU MAPPER ───────────────────────────────────────────────────────────
 *
 * Pure transform: our generic `NavMenuItem` tree → PrimeNG `MenuItem` tree.
 *
 * WHY a separate file
 *   PrimeNG's `MenuItem` is a render-layer detail. Components that already
 *   know how to render a `MenuItem` (`p-menubar`, `p-menu`, `p-panelmenu`)
 *   should keep that knowledge — but business code shouldn't know or care.
 *   Centralising the mapping here means a future renderer swap (Material,
 *   custom) is one file, not a dozen.
 *
 * STATELESS
 *   The mapper takes the items and returns a fresh tree. No caching, no
 *   memoisation — Angular signals already memoise upstream of this call,
 *   and the tree is small (single-digit hundreds of nodes at the worst).
 */
import type { MenuItem } from 'primeng/api';

import type { NavMenuItem } from './nav-menu.types';

/**
 * Maps our generic `NavMenuItem[]` to PrimeNG `MenuItem[]`. `'separator'`
 * nodes become PrimeNG separators (single field). `'action'` nodes get the
 * supplied command wrapped so PrimeNG's invocation contract is honoured
 * (PrimeNG passes a `MenuItemCommandEvent` we don't need).
 */
export function toPrimeMenuItems(items: readonly NavMenuItem[]): MenuItem[] {
  return items.map(toPrimeMenuItem);
}

function toPrimeMenuItem(item: NavMenuItem): MenuItem {
  if (item.kind === 'separator') {
    return { separator: true };
  }

  const base: MenuItem = {
    id: item.id,
    label: item.label,
    icon: item.icon,
    disabled: item.disabled,
    badge: item.badge !== undefined ? String(item.badge) : undefined,
    badgeStyleClass:
      item.badgeSeverity !== undefined ? `p-badge-${item.badgeSeverity}` : undefined,
    tooltip: item.tooltip,
  };

  if (item.kind === 'group' && item.children?.length) {
    return { ...base, items: toPrimeMenuItems(item.children) };
  }

  if (item.kind === 'link' && item.routerLink) {
    if (item.external && typeof item.routerLink === 'string') {
      // External links bypass the router — render as a real `<a href>` so
      // ctrl/cmd-click and "open in new tab" work the way users expect.
      return {
        ...base,
        url: item.routerLink,
        target: '_blank',
      };
    }
    return {
      ...base,
      // PrimeNG accepts strings or arrays here, matching Angular's
      // RouterLink semantics.
      routerLink: item.routerLink as string | (string | number)[],
    };
  }

  if (item.kind === 'action' && item.command) {
    return {
      ...base,
      command: () => item.command?.(),
    };
  }

  return base;
}
