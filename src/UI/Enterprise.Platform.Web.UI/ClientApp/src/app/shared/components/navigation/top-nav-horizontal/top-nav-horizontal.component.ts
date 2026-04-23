/**
 * ─── TOP NAV — HORIZONTAL (Variant A) ──────────────────────────────────────────
 *
 * Single-row chrome:
 *   `[ Logo + Product ] [ Menubar … ] [ Search ] [ Apps | Bell | User ]`
 *
 * Best fit for shallow menus (≤ 7 top-level items, single submenu level) and
 * marketing-leaning product surfaces. PrimeNG's `p-menubar` collapses the
 * middle items into a hamburger overflow on narrow viewports automatically.
 *
 * NOT recommended for healthcare / finance / HR — those domains tend to have
 * deep hierarchies that force the overflow menu to dominate, hiding key
 * destinations. Use `TopNavWithSidebarComponent` for those.
 *
 * EVENTS — same shape as the other variants so the AppShell can swap freely.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';

import type { NavBranding, NavMenuItem } from '../nav-menu.types';
import { toPrimeMenuItems } from '../nav-menu-mapper';
import { NotificationsPopoverComponent, type NavNotification } from '../notifications-popover/notifications-popover.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

@Component({
  selector: 'app-top-nav-horizontal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonModule,
    MenubarModule,
    TooltipModule,
    UserMenuComponent,
    NotificationsPopoverComponent,
  ],
  template: `
    <header
      class="sticky top-0 z-[var(--ep-z-sticky)] flex h-[var(--ep-header-height)] items-center gap-3 border-b border-[color:var(--ep-border)] bg-[color:var(--ep-surface-0)] px-3 shadow-[var(--ep-shadow-xs)] lg:px-4"
      role="banner"
    >
      <a
        [routerLink]="branding().homeRouterLink ?? '/'"
        class="flex flex-shrink-0 items-center gap-2 rounded-ep-md px-1 py-1 focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
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
        <span class="hidden flex-col leading-tight md:flex">
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

      <!-- The menubar takes the remaining space; PrimeNG collapses to a
           hamburger overflow at the configured breakpoint. -->
      <p-menubar [model]="primeItems()" breakpoint="960px" styleClass="ep-nav-menubar flex-1 border-0 bg-transparent" />

      @if (showSearch()) {
        <button
          type="button"
          class="hidden h-9 min-w-[10rem] items-center gap-2 rounded-ep-md border border-[color:var(--ep-border)] bg-[color:var(--ep-surface-50)] px-3 text-left text-sm text-[color:var(--ep-text-muted)] hover:border-[color:var(--ep-border-strong)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)] md:inline-flex"
          aria-label="Open search"
          (click)="searchClick.emit()"
        >
          <i class="pi pi-search text-sm" aria-hidden="true"></i>
          <span class="flex-1 truncate">Search</span>
        </button>
      }

      <div class="flex items-center gap-1">
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
  `,
})
export class TopNavHorizontalComponent {
  readonly branding = input.required<NavBranding>();
  readonly items = input.required<readonly NavMenuItem[]>();
  readonly showSearch = input<boolean>(false);
  readonly showApps = input<boolean>(false);
  readonly showNotifications = input<boolean>(true);

  readonly primeItems = computed<MenuItem[]>(() => toPrimeMenuItems(this.items()));

  readonly searchClick = output<void>();
  readonly appsClick = output<void>();
  readonly notificationClick = output<NavNotification>();
  readonly profileClick = output<void>();
  readonly settingsClick = output<void>();
}
