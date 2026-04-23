/**
 * ─── TOP NAV — WITH SIDEBAR (Variant B / DEFAULT) ──────────────────────────────
 *
 * The recommended chrome for healthcare / finance / HR domains:
 *   - App bar across the top with logo, hamburger, optional global search,
 *     and right-side actions (apps grid, notifications, user menu).
 *   - Vertical drawer on the left holds the primary navigation tree.
 *   - Drawer collapses to icon-only on `lg+`, fully hides on smaller breakpoints
 *     and re-opens as a modal overlay on hamburger click.
 *
 * WHY DEFAULT FOR ENTERPRISE
 *   These domains have deep, hierarchical menus (10+ top-level areas, multiple
 *   nesting levels). A horizontal-only nav can't scale past ~7 items without
 *   resorting to overflow menus that hide important destinations. The vertical
 *   drawer keeps everything addressable, supports submenus naturally, and
 *   leaves the top bar free for context (search, user identity).
 *
 * RESPONSIVENESS
 *   - `< md` (mobile)  : drawer is hidden by default, hamburger toggles it as a modal overlay.
 *   - `md ≥ < lg`      : drawer is hidden by default, hamburger toggles it as a modal overlay.
 *   - `lg+`            : drawer is pinned (non-modal), hamburger toggles full↔collapsed.
 *
 *   The `[modal]` flag on `p-drawer` controls whether the backdrop blocks
 *   clicks; we flip it based on the breakpoint state so the desktop drawer
 *   stays inert when interacted with.
 *
 * EVENTS
 *   The variant exposes `(searchClick)` / `(appsClick)` / `(notificationClick)`
 *   / `(profileClick)` / `(settingsClick)` so the AppShell can wire them
 *   without dragging routing knowledge into the navigation primitive.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { PanelMenuModule } from 'primeng/panelmenu';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';

import type { NavBranding, NavMenuItem } from '../nav-menu.types';
import { toPrimeMenuItems } from '../nav-menu-mapper';
import { NotificationsPopoverComponent, type NavNotification } from '../notifications-popover/notifications-popover.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

const DESKTOP_BREAKPOINT = '(min-width: 1024px)';

@Component({
  selector: 'app-top-nav-with-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    PanelMenuModule,
    TooltipModule,
    UserMenuComponent,
    NotificationsPopoverComponent,
  ],
  template: `
    <header
      class="sticky top-0 z-[var(--ep-z-sticky)] flex h-[var(--ep-header-height)] items-center gap-3 border-b border-[color:var(--ep-border)] bg-[color:var(--ep-surface-0)] px-3 shadow-[var(--ep-shadow-xs)] lg:px-4"
      role="banner"
    >
      <!-- Hamburger / drawer toggle. Always visible. -->
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-ep-md text-[color:var(--ep-text-secondary)] hover:bg-[color:var(--ep-surface-100)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
        [attr.aria-label]="drawerOpen() ? 'Close navigation' : 'Open navigation'"
        [attr.aria-expanded]="drawerOpen()"
        aria-controls="app-shell-drawer"
        (click)="toggleDrawer()"
      >
        <i class="pi pi-bars text-lg" aria-hidden="true"></i>
      </button>

      <!-- Branding -->
      <a
        [routerLink]="branding().homeRouterLink ?? '/'"
        class="flex items-center gap-2 rounded-ep-md px-1 py-1 focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
        aria-label="Go to home"
      >
        @if (branding().logoSrc) {
          <img
            [src]="branding().logoSrc!"
            alt=""
            class="h-7 w-7 flex-shrink-0 rounded-ep-sm object-contain"
          />
        } @else {
          <span
            class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-ep-sm bg-[color:var(--ep-color-primary-600)] text-white"
            aria-hidden="true"
          >
            <i [class]="branding().logoIcon ?? 'pi pi-bolt'"></i>
          </span>
        }
        <span class="hidden flex-col leading-tight sm:flex">
          <span class="text-sm font-semibold text-[color:var(--ep-text-primary)]">
            {{ branding().productName }}
          </span>
          @if (branding().productSubLabel) {
            <span class="text-[10px] uppercase tracking-wider text-[color:var(--ep-text-muted)]">
              {{ branding().productSubLabel }}
            </span>
          }
        </span>
      </a>

      <!-- Optional search box (slot-style: a button that emits an event so the
           host can open a command-palette dialog, search drawer, etc.). -->
      @if (showSearch()) {
        <button
          type="button"
          class="ml-2 hidden h-9 min-w-[14rem] flex-1 items-center gap-2 rounded-ep-md border border-[color:var(--ep-border)] bg-[color:var(--ep-surface-50)] px-3 text-left text-sm text-[color:var(--ep-text-muted)] hover:border-[color:var(--ep-border-strong)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)] md:inline-flex md:max-w-md"
          aria-label="Open search"
          (click)="searchClick.emit()"
        >
          <i class="pi pi-search text-sm" aria-hidden="true"></i>
          <span class="flex-1 truncate">Search</span>
          <kbd
            class="hidden rounded-ep-sm border border-[color:var(--ep-border)] bg-[color:var(--ep-surface-0)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--ep-text-secondary)] sm:inline-block"
          >
            ⌘K
          </kbd>
        </button>
      }

      <!-- Right actions cluster — pushed to the far right. -->
      <div class="ml-auto flex items-center gap-1">
        @if (showApps()) {
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-ep-md text-[color:var(--ep-text-secondary)] hover:bg-[color:var(--ep-surface-100)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
            aria-label="App switcher"
            pTooltip="Apps"
            tooltipPosition="bottom"
            (click)="appsClick.emit()"
          >
            <i class="pi pi-th-large text-lg" aria-hidden="true"></i>
          </button>
        }

        @if (showNotifications()) {
          <app-notifications-popover (notificationClick)="notificationClick.emit($event)" />
        }

        <app-user-menu
          (profileClick)="profileClick.emit()"
          (settingsClick)="settingsClick.emit()"
        />
      </div>
    </header>

    <!-- Vertical nav drawer.
         The modal flag flips with the desktop breakpoint so the desktop drawer
         is non-blocking. position="left" is hard-coded — RTL hosts can wrap
         this variant and flip via CSS or the dir attribute. -->
    <p-drawer
      id="app-shell-drawer"
      [(visible)]="drawerVisible"
      position="left"
      [modal]="!isDesktop()"
      [dismissible]="true"
      [showCloseIcon]="!isDesktop()"
      [closeOnEscape]="true"
      header="Navigation"
      styleClass="w-72 max-w-[85vw]"
    >
      <p-panelmenu
        [model]="primeItems()"
        styleClass="ep-nav-panelmenu"
        [multiple]="true"
      />
    </p-drawer>
  `,
})
export class TopNavWithSidebarComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Branding payload — host (or tenant theming layer) supplies this. */
  readonly branding = input.required<NavBranding>();

  /** The (already-filtered) menu tree to render. */
  readonly items = input.required<readonly NavMenuItem[]>();

  /**
   * Toggle the search button. Hosts that haven't built a command palette yet
   * leave this off (default).
   */
  readonly showSearch = input<boolean>(false);

  /** Show the apps-grid icon (multi-product app switcher). Default off. */
  readonly showApps = input<boolean>(false);

  /** Show the notifications bell. Default on. */
  readonly showNotifications = input<boolean>(true);

  /**
   * Drawer state. On desktop we default to open (pinned); on smaller
   * viewports we default closed. The breakpoint listener flips this at
   * runtime when the viewport crosses the threshold.
   */
  readonly drawerVisible = signal<boolean>(false);

  /** Public read-only mirror used by the trigger button's `aria-expanded`. */
  readonly drawerOpen = this.drawerVisible.asReadonly();

  /** Tracks viewport state via matchMedia listener. */
  readonly isDesktop = signal<boolean>(false);

  /** Eagerly-mapped PrimeNG model — recomputes on items() changes only. */
  readonly primeItems = computed<MenuItem[]>(() => toPrimeMenuItems(this.items()));

  // ── EVENT OUTPUTS — host wires routing/handlers ──────────────────────────
  readonly searchClick = output<void>();
  readonly appsClick = output<void>();
  readonly notificationClick = output<NavNotification>();
  readonly profileClick = output<void>();
  readonly settingsClick = output<void>();

  constructor() {
    this.subscribeToBreakpoint();
  }

  toggleDrawer(): void {
    this.drawerVisible.update((open) => !open);
  }

  /**
   * Listens to `(min-width: 1024px)` so we can pin the drawer on desktop and
   * collapse it on narrower viewports. Listener detached on destroy.
   */
  private subscribeToBreakpoint(): void {
    const mql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(DESKTOP_BREAKPOINT)
        : null;
    if (!mql) return;

    const apply = (matches: boolean): void => {
      this.isDesktop.set(matches);
      // Pinned-open on desktop, closed on entry to mobile so the user
      // explicitly opens the modal when they need it.
      this.drawerVisible.set(matches);
    };

    apply(mql.matches);

    const handler = (e: MediaQueryListEvent): void => apply(e.matches);
    mql.addEventListener('change', handler);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
  }
}
