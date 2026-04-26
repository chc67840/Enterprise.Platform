/**
 * ─── shared/layout/components/user-menu-button ──────────────────────────────────
 *
 * Spec D4. Avatar trigger → PrimeNG popup menu rendered from
 * `NavUserMenuConfig.menuItems: readonly UserMenuItem[]`. First menu row is a
 * non-clickable header carrying displayName + email + orgName so the menu
 * doubles as the "you are" identity surface.
 *
 * Rows discriminated by `kind`:
 *   - `'link'`     → MenuItem.routerLink (or url for external)
 *   - `'divider'`  → { separator: true }
 *   - `'action'`   → command emits NavActionEvent (parent navbar funnels into (navAction))
 *                    EXCEPT when `isLogout: true` — that fires (logout) instead.
 *
 * No theme cycler here (per spec the theme toggle is its OWN right-zone widget).
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  input,
  output,
} from '@angular/core';
import { type Menu, MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import type { MenuItem } from 'primeng/api';

import type {
  NavActionEvent,
  NavLogoutEvent,
  NavUserMenuConfig,
  UserMenuAction,
  UserMenuItem,
  UserMenuLink,
  UserProfile,
} from '@shared/layout';

@Component({
  selector: 'app-user-menu-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, MenuModule],
  template: `
    <button
      type="button"
      class="ep-user-btn"
      [attr.data-tone]="tone()"
      aria-haspopup="true"
      [attr.aria-label]="'Account menu for ' + (profile()?.displayName || profile()?.email || 'user')"
      (click)="menu.toggle($event)"
    >
      @if (profile()?.avatarUrl) {
        <img
          [src]="profile()!.avatarUrl!"
          [alt]="profile()!.displayName + ' avatar'"
          class="h-8 w-8 rounded-full object-cover"
          width="32"
          height="32"
          loading="lazy"
        />
      } @else {
        <p-avatar
          [label]="initials()"
          shape="circle"
          size="normal"
          [styleClass]="tone() === 'dark' ? 'ep-user-avatar-dark' : 'ep-user-avatar-light'"
          aria-hidden="true"
        />
      }

      @if (config().showNameInHeader && profile()) {
        <span class="ep-user-name hidden flex-col leading-tight text-left sm:flex">
          <span class="max-w-[12rem] truncate text-sm font-medium">{{ profile()!.displayName }}</span>
          @if (config().showRoleInHeader && profile()!.role) {
            <span class="max-w-[12rem] truncate text-[11px] opacity-75">{{ profile()!.role }}</span>
          }
        </span>
      }

      <i class="pi pi-chevron-down text-xs opacity-80" aria-hidden="true"></i>
    </button>

    <p-menu #menu [model]="primeMenuItems()" [popup]="true" appendTo="body" styleClass="ep-user-menu" />
  `,
  styles: [
    `
      .ep-user-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        background-color: transparent;
        font-weight: 500;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-user-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-user-btn[data-tone='light'] { color: var(--ep-text-primary); }
      .ep-user-btn[data-tone='light']:hover { background-color: var(--ep-surface-100); }
      .ep-user-btn[data-tone='dark'] { color: #ffffff; }
      .ep-user-btn[data-tone='dark']:hover { background-color: rgba(255, 255, 255, 0.12); }

      :host ::ng-deep .ep-user-avatar-light {
        background-color: var(--ep-color-primary-600) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
      }
      :host ::ng-deep .ep-user-avatar-dark {
        background-color: var(--ep-color-jessamine-500) !important;
        color: var(--ep-color-primary-900) !important;
        font-weight: 600 !important;
      }

      /* User-menu popup styling — header row + sign-out row treatment. */
      :host ::ng-deep .ep-user-menu .p-menu {
        min-width: 16rem;
        border-radius: 0.5rem;
        border: 1px solid var(--ep-color-neutral-200);
        box-shadow: 0 8px 24px rgba(15, 31, 59, 0.15);
        padding: 0.25rem;
      }
      :host ::ng-deep .ep-user-menu .ep-user-menu__header {
        padding: 0.75rem 0.875rem 0.5rem;
        border-bottom: 1px solid var(--ep-color-neutral-200);
        margin-bottom: 0.25rem;
        pointer-events: none;
      }
      :host ::ng-deep .ep-user-menu .ep-user-menu__header .p-menu-item-link {
        background: transparent !important;
        cursor: default !important;
      }
      :host ::ng-deep .ep-user-menu .ep-user-menu__logout .p-menu-item-link {
        color: var(--ep-color-danger-700);
      }
      :host ::ng-deep .ep-user-menu .ep-user-menu__logout .p-menu-item-link:hover {
        background-color: var(--ep-color-danger-50);
      }
    `,
  ],
})
export class UserMenuButtonComponent {
  readonly config = input.required<NavUserMenuConfig>();
  readonly profile = input<UserProfile | null>(null);
  readonly tone = input<'light' | 'dark'>('dark');

  /** Action rows funnel through here (parent funnels into (navAction) with source 'userMenu'). */
  readonly actionTriggered = output<NavActionEvent>();

  /** Sign-out row fires this — never (actionTriggered) — so the host knows to clear creds. */
  readonly logout = output<NavLogoutEvent>();

  @ViewChild('menu') menu!: Menu;

  /** First-letter-of-first-and-last-name initials for the avatar fallback. */
  protected readonly initials = computed<string>(() => {
    const p = this.profile();
    if (!p) return '?';
    const name = p.displayName.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? '';
      const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
      return (first + last).toUpperCase() || '?';
    }
    return p.email.charAt(0).toUpperCase() || '?';
  });

  /**
   * Adapts the spec's `UserMenuItem[]` into PrimeNG's `MenuItem[]`. Inserts a
   * non-clickable header row at index 0 carrying displayName + email + orgName.
   */
  protected readonly primeMenuItems = computed<MenuItem[]>(() => {
    const out: MenuItem[] = [];
    const p = this.profile();

    if (p) {
      out.push({
        label: p.displayName,
        styleClass: 'ep-user-menu__header',
        // Build the multi-line label as innerHTML via templated escaped content
        // would be neat, but PrimeNG's MenuItem doesn't render HTML safely.
        // Instead use the <ng-template> form via items[]:items shape — we keep
        // it simple here: label = name; subLabel becomes a separate disabled row
        // hidden visually if a renderer doesn't show it.
        disabled: false,
        command: () => undefined,
      });
      // Email + org as a second non-clickable line.
      const subline = p.orgName ? `${p.email} · ${p.orgName}` : p.email;
      out.push({
        label: subline,
        styleClass: 'ep-user-menu__header',
        disabled: false,
        command: () => undefined,
      });
      out.push({ separator: true });
    }

    for (const item of this.config().menuItems) {
      switch (item.kind) {
        case 'divider':
          out.push({ separator: true });
          break;
        case 'link':
          out.push(this.toLinkMenuItem(item));
          break;
        case 'action':
          out.push(this.toActionMenuItem(item));
          break;
      }
    }
    return out;
  });

  private toLinkMenuItem(item: UserMenuLink): MenuItem {
    const base: MenuItem = {
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
    };
    if (item.externalUrl) {
      return { ...base, url: item.externalUrl, target: '_blank' };
    }
    if (item.routePath) {
      // PrimeNG accepts string | any[] for routerLink.
      base.routerLink = item.routePath as MenuItem['routerLink'];
    }
    return base;
  }

  private toActionMenuItem(item: UserMenuAction): MenuItem {
    const base: MenuItem = {
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      styleClass: item.isLogout ? 'ep-user-menu__logout' : undefined,
      command: () => {
        if (item.isLogout) {
          const userId = this.profile()?.id ?? '';
          this.logout.emit({ userId });
        } else {
          this.actionTriggered.emit({
            source: 'userMenu',
            actionKey: item.actionKey,
          });
        }
      },
    };
    return base;
  }
}
