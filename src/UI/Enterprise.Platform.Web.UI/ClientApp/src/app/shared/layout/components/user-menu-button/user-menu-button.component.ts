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
  signal,
} from '@angular/core';
import { type Menu, MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import type { MenuItem } from 'primeng/api';

import { toInitials } from '@utils';
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
      aria-haspopup="menu"
      [attr.aria-expanded]="isOpen()"
      [attr.aria-label]="'Account menu for ' + (profile()?.displayName || profile()?.email || 'user')"
      (click)="onTriggerClick($event)"
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

    <p-menu
      #menu
      [model]="primeMenuItems()"
      [popup]="true"
      appendTo="body"
      styleClass="ep-user-menu"
      (onShow)="isOpen.set(true)"
      (onHide)="isOpen.set(false)"
    />
  `,
  styleUrl: './user-menu-button.component.scss',
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

  /** Mirrors PrimeNG's onShow/onHide for the trigger's aria-expanded. */
  protected readonly isOpen = signal<boolean>(false);

  /** stopPropagation defends against stale popup document listeners eating the open click. */
  protected onTriggerClick(event: Event): void {
    event.stopPropagation();
    this.menu.toggle(event);
  }

  /** First-letter-of-first-and-last-name initials for the avatar fallback. */
  protected readonly initials = computed<string>(() => {
    const p = this.profile();
    if (!p) return '?';
    // Prefer displayName-derived initials; fall back to first email character
    // when the user has no display name yet (e.g. fresh sign-in).
    const fromName = toInitials(p.displayName);
    if (fromName !== '?') return fromName;
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
