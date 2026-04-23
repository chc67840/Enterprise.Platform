/**
 * Barrel for the navigation primitives. Hosts pick the variant they want
 * (most should pick `TopNavWithSidebarComponent`) and the shared service +
 * type set ride along.
 */
export type { NavMenuItem, NavBranding, NavMenuItemKind, NavVariant } from './nav-menu.types';
export { MenuConfigService } from './menu-config.service';
export { toPrimeMenuItems } from './nav-menu-mapper';

export { UserMenuComponent } from './user-menu/user-menu.component';
export { NotificationsPopoverComponent } from './notifications-popover/notifications-popover.component';
export type { NavNotification } from './notifications-popover/notifications-popover.component';

export { TopNavWithSidebarComponent } from './top-nav-with-sidebar/top-nav-with-sidebar.component';
export { TopNavHorizontalComponent } from './top-nav-horizontal/top-nav-horizontal.component';
export { TopNavCompactComponent } from './top-nav-compact/top-nav-compact.component';
