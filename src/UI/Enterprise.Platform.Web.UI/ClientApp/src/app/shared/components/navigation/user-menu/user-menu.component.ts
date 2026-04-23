/**
 * ─── USER MENU ─────────────────────────────────────────────────────────────────
 *
 * Right-side identity affordance shared by every nav variant. Renders the
 * current user's avatar (initials fallback) + name, and on click opens a
 * popover-style menu with Profile / Settings / Theme toggle / Sign out.
 *
 * WHY shared
 *   Three nav variants would otherwise re-implement the same auth wiring,
 *   theme toggle, and accessibility plumbing three times — drift is
 *   inevitable. Centralising here also makes the swap to PrimeNG's `p-menu`
 *   templating (e.g. tenant-specific items) a one-file change.
 *
 * MENU CONTENT
 *   - Profile — emits `(profileClick)` so the host can route or open a
 *     sheet. We don't hard-code `/profile` here because feature placement
 *     varies across deployments (some embed inside the user route tree,
 *     some have a flat `/me`).
 *   - Settings — same emit pattern (`settingsClick`).
 *   - Theme — three-state toggle: light / dark / system (cycles via
 *     ThemeService.cycle()). Icon reflects the *current* mode.
 *   - Sign out — calls `AuthService.logout()` directly. This one is
 *     hard-coded because logout is universal.
 *
 * ACCESSIBILITY
 *   - Trigger button has `aria-haspopup="true"` + `aria-expanded` toggled by
 *     PrimeNG. Avatar is `aria-hidden` (decorative); the visible name is the
 *     accessible label.
 *   - PrimeNG handles arrow-key navigation + escape-to-close out of the box.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject,
  output,
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { type Menu, MenuModule } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';

import { AuthService } from '@core/auth';
import { ThemeService } from '@core/services';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarModule, MenuModule],
  template: `
    <button
      type="button"
      class="flex items-center gap-2 rounded-ep-md px-2 py-1 text-sm font-medium text-[color:var(--ep-text-primary)] hover:bg-[color:var(--ep-surface-100)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
      aria-haspopup="true"
      [attr.aria-label]="'Open account menu for ' + (auth.displayName() || auth.email())"
      (click)="menu.toggle($event)"
    >
      <p-avatar
        [label]="initials()"
        shape="circle"
        size="normal"
        styleClass="bg-[color:var(--ep-color-primary-600)] text-white"
        aria-hidden="true"
      />
      @if (showName()) {
        <span class="hidden max-w-[12rem] truncate text-left sm:inline-block">
          {{ auth.displayName() || auth.email() }}
        </span>
      }
      <i class="pi pi-chevron-down text-xs text-[color:var(--ep-text-secondary)]" aria-hidden="true"></i>
    </button>

    <p-menu #menu [model]="items()" [popup]="true" appendTo="body" />
  `,
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  /** When `false`, only the avatar + chevron render — useful for compact bar. */
  readonly showName = computed(() => true);

  /** Emits when the user picks "Profile". Host decides routing. */
  readonly profileClick = output<void>();

  /** Emits when the user picks "Settings". Host decides routing. */
  readonly settingsClick = output<void>();

  /** PrimeNG popup-menu reference — needed so the trigger button can `toggle($event)`. */
  @ViewChild('menu') menu!: Menu;

  /**
   * Two-letter initials derived from the display name. Falls back to the
   * email's local-part initial when no display name is set, then to a
   * generic icon-glyph as a final guard. Computed so it re-runs only when
   * the underlying signals change.
   */
  readonly initials = computed<string>(() => {
    const name = this.auth.displayName().trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? '';
      const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
      return (first + last).toUpperCase() || '?';
    }
    const email = this.auth.email();
    return email.charAt(0).toUpperCase() || '?';
  });

  /**
   * The PrimeNG menu model. Recomputed on theme-mode changes so the icon
   * + label of the theme item reflect the current selection without a
   * manual subscription.
   */
  readonly items = computed<MenuItem[]>(() => {
    const themeMode = this.theme.mode();
    const themeIcon =
      themeMode === 'light' ? 'pi pi-sun' : themeMode === 'dark' ? 'pi pi-moon' : 'pi pi-desktop';
    const themeLabel = `Theme: ${themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light'}`;

    return [
      {
        label: 'Account',
        items: [
          {
            label: 'Profile',
            icon: 'pi pi-user',
            command: () => this.profileClick.emit(),
          },
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            command: () => this.settingsClick.emit(),
          },
        ],
      },
      {
        label: 'Preferences',
        items: [
          {
            label: themeLabel,
            icon: themeIcon,
            command: () => this.theme.cycle(),
          },
        ],
      },
      {
        separator: true,
      },
      {
        label: 'Sign out',
        icon: 'pi pi-sign-out',
        command: () => this.auth.logout(),
      },
    ];
  });
}
