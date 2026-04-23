/**
 * ─── TOP NAV — COMPACT (Variant C) ─────────────────────────────────────────────
 *
 * Minimal app bar:
 *   `[ Logo ] [ ProductName ]                       [ Menu | Bell | User ]`
 *
 * The full menu collapses into a single overflow popover (`p-menu` in
 * popup mode), keeping the bar uncluttered. Aimed at:
 *   - Embedded scenarios (the SPA hosted as a tab inside another product).
 *   - Mobile-first surfaces where vertical space is scarce.
 *   - Kiosk / single-purpose apps where navigation is a secondary affordance.
 *
 * Drop-in compatible with the other variants — same inputs, same outputs.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { type Menu, MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import type { MenuItem } from 'primeng/api';

import type { NavBranding, NavMenuItem } from '../nav-menu.types';
import { toPrimeMenuItems } from '../nav-menu-mapper';
import { NotificationsPopoverComponent, type NavNotification } from '../notifications-popover/notifications-popover.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

@Component({
  selector: 'app-top-nav-compact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonModule,
    MenuModule,
    TooltipModule,
    UserMenuComponent,
    NotificationsPopoverComponent,
  ],
  template: `
    <header
      class="sticky top-0 z-[var(--ep-z-sticky)] flex h-[var(--ep-header-height)] items-center gap-3 border-b border-[color:var(--ep-border)] bg-[color:var(--ep-surface-0)] px-3 shadow-[var(--ep-shadow-xs)]"
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
        <span class="text-sm font-semibold text-[color:var(--ep-text-primary)]">
          {{ branding().productName }}
        </span>
      </a>

      <div class="ml-auto flex items-center gap-1">
        @if (primeItems().length > 0) {
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-ep-md text-[color:var(--ep-text-secondary)] hover:bg-[color:var(--ep-surface-100)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
            aria-haspopup="true"
            aria-label="Open navigation menu"
            pTooltip="Menu"
            tooltipPosition="bottom"
            (click)="overflowMenu.toggle($event)"
          >
            <i class="pi pi-bars text-lg" aria-hidden="true"></i>
          </button>
          <p-menu #overflowMenu [model]="primeItems()" [popup]="true" appendTo="body" />
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
export class TopNavCompactComponent {
  readonly branding = input.required<NavBranding>();
  readonly items = input.required<readonly NavMenuItem[]>();

  /**
   * Compact bar omits search by default — the surface is too narrow. Hosts
   * that want it can re-enable, but the recommendation is to wire the
   * keyboard shortcut (`⌘K`) instead and skip the visible button.
   */
  readonly showSearch = input<boolean>(false);
  readonly showApps = input<boolean>(false);
  readonly showNotifications = input<boolean>(true);

  readonly primeItems = computed<MenuItem[]>(() => toPrimeMenuItems(this.items()));

  @ViewChild('overflowMenu') overflowMenu!: Menu;

  readonly searchClick = output<void>();
  readonly appsClick = output<void>();
  readonly notificationClick = output<NavNotification>();
  readonly profileClick = output<void>();
  readonly settingsClick = output<void>();
}
