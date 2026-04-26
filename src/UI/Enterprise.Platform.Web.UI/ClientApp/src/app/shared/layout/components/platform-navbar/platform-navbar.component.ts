/**
 * ─── shared/layout/components/platform-navbar ───────────────────────────────────
 *
 * Phase F.2 — config-driven canonical chrome navbar. Consumes the F.1 type
 * system end-to-end:
 *
 *   <app-platform-navbar
 *     [config]="navbarConfig()"
 *     [userProfile]="user()"
 *     [notifications]="notifications()"
 *     [unreadMessageCount]="unreadMessages()"
 *     [marketOpen]="markets.isOpen()"
 *     [onDuty]="shift.isOnDuty()"
 *     (navAction)="dispatch($event)"
 *     (tenantSwitch)="onTenantSwitch($event)"
 *     (searched)="onSearch($event)"
 *     (logout)="onLogout($event)" />
 *
 * SUPERSEDES `PlatformTopNavComponent` (the prior horizontal-only nav). The
 * old component remains exported from `shared/components/navigation` until
 * F.6 cleans it up — kept temporarily so any out-of-tree consumer doesn't
 * break in the middle of the refit.
 *
 * RIGHT-ZONE WIDGETS — INLINE FOR F.2
 *   Per the F-phase plan, the simple display widgets (clock, env badge,
 *   theme toggle, language switcher, search button, AI button, help button,
 *   messages bell) live inline here in F.2. F.3 extracts them into
 *   dedicated components without changing the component's external surface.
 *
 *   The complex widgets (NotificationBellComponent, UserMenuButtonComponent,
 *   TenantSwitcherComponent) ARE separate now because they own a popover +
 *   internal state — the spec D4/D5 deliverables.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { UserMenuButtonComponent } from '../user-menu-button/user-menu-button.component';
import { NavMenuComponent } from '../nav-menu/nav-menu.component';
import { LanguageSwitcherComponent } from '../widgets/language-switcher.component';
import { NavClockComponent } from '../widgets/nav-clock.component';
import { QuickActionsComponent } from '../widgets/quick-actions.component';
import { ThemeToggleButtonComponent } from '../widgets/theme-toggle-button.component';
import type {
  NavActionEvent,
  NavLogoutEvent,
  NavNotification,
  NavSearchEvent,
  NavTenantSwitchEvent,
  NavbarConfig,
  UserProfile,
} from '@shared/layout';

@Component({
  selector: 'app-platform-navbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    TooltipModule,
    NavMenuComponent,
    NotificationBellComponent,
    UserMenuButtonComponent,
    NavClockComponent,
    ThemeToggleButtonComponent,
    LanguageSwitcherComponent,
    QuickActionsComponent,
  ],
  template: `
    <!-- Skip-to-main link — first focusable element. WCAG 2.4.1. -->
    <a
      href="#main-content"
      class="ep-skip-link"
    >Skip to main content</a>

    <nav
      class="ep-navbar"
      [class.ep-navbar--sticky]="sticky()"
      [class.ep-navbar--glass]="glassEnabled()"
      [class.ep-navbar--scrolled]="isScrolled()"
      [style.--nav-height.px]="heightPx()"
      role="navigation"
      aria-label="Primary"
    >
      <div class="ep-navbar__row">
        <!-- ═══════════ LEFT ZONE ═══════════ -->
        <div class="ep-navbar__left">
          <a
            [routerLink]="config().leftZone.logo.homeRoute"
            class="ep-navbar__brand"
            [attr.aria-label]="config().leftZone.logo.alt"
          >
            @if (config().leftZone.logo.imageSrc) {
              <img
                [src]="config().leftZone.logo.imageSrc!"
                [alt]="config().leftZone.logo.alt"
                width="32"
                height="32"
                loading="eager"
                class="ep-navbar__logo-img"
              />
            } @else {
              <span class="ep-navbar__logo-glyph" aria-hidden="true">
                <i class="pi pi-bolt"></i>
              </span>
            }
            @if (config().leftZone.logo.brandName) {
              <span class="ep-navbar__brand-text">
                <span class="ep-navbar__brand-name">{{ config().leftZone.logo.brandName }}</span>
                @if (config().leftZone.logo.subLabel) {
                  <span class="ep-navbar__brand-sub">{{ config().leftZone.logo.subLabel }}</span>
                }
              </span>
            }
          </a>

          @if (showEnvBadge()) {
            <span
              class="ep-env-badge"
              [attr.data-env]="config().leftZone.logo.envBadge"
              [attr.aria-label]="'Environment: ' + config().leftZone.logo.envBadge"
            >{{ config().leftZone.logo.envBadge }}</span>
          }

        </div>

        <!-- ═══════════ CENTER ZONE ═══════════ -->
        <div class="ep-navbar__center">
          <app-nav-menu
            [config]="config().centerZone.menu"
            tone="dark"
            (action)="navAction.emit($event)"
          />
        </div>

        <!-- ═══════════ RIGHT ZONE ═══════════ -->
        <div class="ep-navbar__right">
          @if (config().rightZone.clock?.enabled) {
            <app-nav-clock [config]="config().rightZone.clock!" />
          }

          @if (config().rightZone.marketStatus?.enabled) {
            <span
              class="ep-status-pill"
              [class.ep-status-pill--positive]="marketOpen()"
              [class.ep-status-pill--negative]="!marketOpen()"
            >
              <span class="ep-status-pill__dot" [class.ep-status-pill__dot--pulse]="marketOpen()"></span>
              <span>Markets {{ marketOpen() ? 'open' : 'closed' }}</span>
            </span>
          }

          @if (config().rightZone.shiftStatus?.enabled) {
            <span
              class="ep-status-pill"
              [class.ep-status-pill--positive]="onDuty()"
              [class.ep-status-pill--negative]="!onDuty()"
            >
              <span class="ep-status-pill__dot"></span>
              <span>{{ config().rightZone.shiftStatus!.label ?? (onDuty() ? 'On duty' : 'Off duty') }}</span>
            </span>
          }

          @if (config().rightZone.globalSearch?.enabled) {
            <button
              type="button"
              class="ep-icon-btn"
              [pTooltip]="searchTooltip()"
              tooltipPosition="bottom"
              [attr.aria-label]="config().rightZone.globalSearch!.placeholder ?? 'Open search'"
              (click)="onSearchClick()"
            >
              <i class="pi pi-search" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.aiAssistant?.enabled) {
            <button
              type="button"
              class="ep-icon-btn ep-icon-btn--accent"
              [pTooltip]="config().rightZone.aiAssistant!.label ?? 'AI assistant'"
              tooltipPosition="bottom"
              [attr.aria-label]="config().rightZone.aiAssistant!.label ?? 'Open AI assistant'"
              (click)="onAiClick()"
            >
              <i [class]="(config().rightZone.aiAssistant!.icon ?? 'pi pi-sparkles')" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.quickActions?.enabled) {
            <app-quick-actions
              [config]="config().rightZone.quickActions!"
              (action)="navAction.emit($event)"
            />
          }

          @if (config().rightZone.messages?.enabled) {
            <app-notification-bell
              [config]="config().rightZone.messages!"
              [notifications]="messageItems()"
              heading="Messages"
              tone="dark"
              (itemClick)="onMessageClick($event)"
            />
          }

          @if (config().rightZone.notifications?.enabled) {
            <app-notification-bell
              [config]="config().rightZone.notifications!"
              [notifications]="notifications()"
              heading="Notifications"
              tone="dark"
              (itemClick)="onNotificationClick($event)"
            />
          }

          @if (config().rightZone.help?.enabled) {
            <button
              type="button"
              class="ep-icon-btn"
              [pTooltip]="config().rightZone.help!.label ?? 'Help'"
              tooltipPosition="bottom"
              aria-label="Open help"
              (click)="onHelpClick()"
            >
              <i [class]="config().rightZone.help!.icon ?? 'pi pi-question-circle'" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.themeToggle?.enabled) {
            <app-theme-toggle-button
              [config]="config().rightZone.themeToggle!"
              tone="dark"
            />
          }

          @if (config().rightZone.languageSwitcher?.enabled) {
            <app-language-switcher
              [config]="config().rightZone.languageSwitcher!"
              (languageChanged)="onLanguageChanged($event)"
            />
          }

          <!-- User menu OR login button -->
          @if (config().rightZone.userMenu.enabled) {
            @if (userProfile()) {
              <app-user-menu-button
                [config]="config().rightZone.userMenu"
                [profile]="userProfile()"
                tone="dark"
                (actionTriggered)="navAction.emit($event)"
                (logout)="logout.emit($event)"
              />
            } @else {
              <a
                routerLink="/auth/login"
                class="ep-login-btn"
              >
                <i class="pi pi-sign-in text-xs" aria-hidden="true"></i>
                <span>Sign in</span>
              </a>
            }
          }

          <!-- Mobile hamburger — visible below the collapse breakpoint via CSS. -->
          <button
            type="button"
            class="ep-icon-btn ep-hamburger"
            [attr.aria-expanded]="isMobileMenuOpen()"
            aria-label="Toggle navigation menu"
            (click)="toggleMobileMenu()"
          >
            <i class="pi" [class.pi-bars]="!isMobileMenuOpen()" [class.pi-times]="isMobileMenuOpen()" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile menu overlay — fixed below the navbar; CSS toggles via [data-open]. -->
    <div
      class="ep-mobile-menu"
      [attr.data-open]="isMobileMenuOpen()"
      role="dialog"
      aria-label="Navigation menu"
      [attr.aria-hidden]="!isMobileMenuOpen()"
    >
      <app-nav-menu
        [config]="config().centerZone.menu"
        tone="light"
        layout="vertical"
        (action)="onMobileNavAction($event)"
      />
    </div>
  `,
  styles: [
    /*
     * BEM-namespaced surface: .ep-navbar / .ep-navbar__row / .ep-navbar__left
     * etc. Every colour resolves through a CSS custom property (no raw hex).
     * Mobile collapse is CSS-only — the @if discriminator only flips an
     * attribute (data-open) for screen-readers + transitions.
     *
     * prefers-reduced-motion disables the pulse + transitions per WCAG 2.3.3.
     */
    `
      :host { display: contents; }

      /* ── skip link ── */
      .ep-skip-link {
        position: absolute;
        left: 0.5rem;
        top: 0.5rem;
        z-index: 50;
        padding: 0.375rem 0.75rem;
        background: #ffffff;
        color: var(--ep-color-primary-700);
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: 0.375rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transform: translateY(-200%);
      }
      .ep-skip-link:focus-visible {
        transform: translateY(0);
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      /* ── navbar surface ── */
      .ep-navbar {
        --nav-height: 64px;
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(15, 31, 59, 0.06);
        z-index: 30;
      }
      .ep-navbar--sticky { position: sticky; top: 0; }
      .ep-navbar--glass.ep-navbar--scrolled {
        background-color: color-mix(in srgb, var(--ep-color-primary-700) 88%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .ep-navbar__row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        height: var(--nav-height);
        padding: 0 1rem;
      }
      @media (min-width: 640px) { .ep-navbar__row { padding: 0 1.5rem; } }
      @media (min-width: 1024px) { .ep-navbar__row { padding: 0 2rem; } }

      /* ── left zone: brand ── */
      .ep-navbar__left {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        flex-shrink: 0;
      }
      .ep-navbar__brand {
        display: inline-flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.25rem 0.375rem;
        border-radius: 0.375rem;
        text-decoration: none;
        color: inherit;
      }
      .ep-navbar__brand:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-navbar__logo-img { display: block; border-radius: 0.25rem; }
      .ep-navbar__logo-glyph {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.375rem;
        background-color: var(--ep-color-jessamine-500);
        color: var(--ep-color-primary-900);
      }
      .ep-navbar__brand-text {
        display: none;
        flex-direction: column;
        line-height: 1.1;
      }
      @media (min-width: 640px) { .ep-navbar__brand-text { display: flex; } }
      .ep-navbar__brand-name { font-size: 0.875rem; font-weight: 600; letter-spacing: -0.01em; }
      .ep-navbar__brand-sub {
        font-size: 0.6875rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.7);
      }

      /* ── env badge ── */
      .ep-env-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background-color: var(--ep-color-jessamine-500);
        color: var(--ep-color-primary-900);
      }
      .ep-env-badge[data-env='dev'] { background-color: var(--ep-color-palmetto-500); color: #fff; }
      .ep-env-badge[data-env='staging'] { background-color: var(--ep-color-jessamine-500); color: var(--ep-color-primary-900); }
      .ep-env-badge[data-env='uat'] { background-color: var(--ep-color-danger-500, #dc2626); color: #fff; }

      /* ── center zone ── */
      /*
       * Centre zone — flex:1 so it claims free space, min-width:0 + overflow
       * hidden so its inner menu can't push the right zone off-screen. The
       * menu's own scrollable behaviour kicks in when items exceed the
       * available space.
       */
      .ep-navbar__center {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        display: none;
      }
      @media (min-width: 1024px) { .ep-navbar__center { display: flex; } }

      /*
       * Right zone — flex-shrink:0 so widgets stay full-width, position:relative
       * + z-index:2 so on accidental overlap (older browsers / unusual aspect
       * ratios) the right-zone widgets paint ON TOP of the centre menu rather
       * than below it. Solves the "icons hidden behind menu items" symptom
       * permanently.
       */
      .ep-navbar__right {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
        margin-left: auto;
        background-color: var(--ep-color-primary-700);
      }

      /* clock + status pills */
      .ep-clock {
        display: none;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        background-color: rgba(255, 255, 255, 0.08);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
      }
      @media (min-width: 768px) { .ep-clock { display: inline-flex; } }
      .ep-clock__tz { font-size: 0.625rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.06em; }

      .ep-status-pill {
        display: none;
        align-items: center;
        gap: 0.375rem;
        padding: 0.25rem 0.625rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
      }
      @media (min-width: 768px) { .ep-status-pill { display: inline-flex; } }
      .ep-status-pill--positive {
        background-color: color-mix(in srgb, var(--ep-color-palmetto-500) 25%, transparent);
        color: var(--ep-color-palmetto-100);
      }
      .ep-status-pill--negative {
        background-color: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.7);
      }
      .ep-status-pill__dot {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 9999px;
        background-color: currentColor;
      }
      @keyframes ep-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.2); }
      }
      .ep-status-pill__dot--pulse { animation: ep-pulse 2s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .ep-status-pill__dot--pulse { animation: none; }
      }

      /* icon buttons */
      .ep-icon-btn {
        display: inline-flex;
        height: 2.5rem;
        width: 2.5rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        background-color: transparent;
        color: rgba(255, 255, 255, 0.92);
        transition: background-color 120ms ease;
      }
      .ep-icon-btn:hover { background-color: rgba(255, 255, 255, 0.12); color: #fff; }
      .ep-icon-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-icon-btn--accent { color: var(--ep-color-jessamine-300); }

      /* language select */
      .ep-lang-select {
        appearance: none;
        background-color: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        font-size: 0.8125rem;
        padding: 0.25rem 1.5rem 0.25rem 0.625rem;
        border-radius: 0.375rem;
        border: none;
        cursor: pointer;
        background-image: linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(135deg, #fff 50%, transparent 50%);
        background-position: calc(100% - 12px) center, calc(100% - 7px) center;
        background-size: 5px 5px;
        background-repeat: no-repeat;
      }
      .ep-lang-select:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-lang-select option { color: var(--ep-color-neutral-900); background: #fff; }

      /* sign-in button */
      .ep-login-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        background-color: var(--ep-color-jessamine-500);
        color: var(--ep-color-primary-900);
        font-size: 0.8125rem;
        font-weight: 600;
        text-decoration: none;
      }
      .ep-login-btn:hover { background-color: var(--ep-color-jessamine-400); }
      .ep-login-btn:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }

      /* hamburger — visible only below center-zone breakpoint */
      .ep-hamburger { display: inline-flex; }
      @media (min-width: 1024px) { .ep-hamburger { display: none; } }

      /* mobile overlay menu */
      .ep-mobile-menu {
        position: fixed;
        top: var(--nav-height);
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 25;
        background-color: var(--ep-color-neutral-50);
        padding: 1rem;
        overflow-y: auto;
        transform: translateY(-110%);
        transition: transform 200ms ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .ep-mobile-menu { transition: none; }
      }
      .ep-mobile-menu[data-open='true'] { transform: translateY(0); }
      @media (min-width: 1024px) { .ep-mobile-menu { display: none; } }
    `,
  ],
})
export class PlatformNavbarComponent {
  // ── inputs (signal inputs per spec) ────────────────────────────────────

  readonly config = input.required<NavbarConfig>();
  readonly userProfile = input<UserProfile | null>(null);
  readonly notifications = input<readonly NavNotification[]>([]);
  readonly messageItems = input<readonly NavNotification[]>([]);
  readonly unreadMessageCount = input<number>(0);
  readonly marketOpen = input<boolean>(false);
  readonly onDuty = input<boolean>(false);

  // ── outputs (single dispatcher per spec D1) ────────────────────────────

  readonly navAction = output<NavActionEvent>();
  readonly tenantSwitch = output<NavTenantSwitchEvent>();
  readonly searched = output<NavSearchEvent>();
  readonly logout = output<NavLogoutEvent>();

  // ── internal state ─────────────────────────────────────────────────────

  protected readonly isMobileMenuOpen = signal(false);
  protected readonly isScrolled = signal(false);

  // ── derived ────────────────────────────────────────────────────────────

  protected readonly sticky = computed(() => this.config().sticky !== false);
  protected readonly heightPx = computed(() => this.config().heightPx ?? 64);
  protected readonly glassEnabled = computed(
    () => this.sticky() && this.config().glassMorphism === true,
  );

  protected readonly showEnvBadge = computed(() => {
    const env = this.config().leftZone.logo.envBadge;
    return env !== undefined && env !== 'production';
  });

  protected readonly searchTooltip = computed(() => {
    const cfg = this.config().rightZone.globalSearch;
    if (!cfg) return '';
    return cfg.commandPaletteMode ? 'Search (Ctrl+/)' : (cfg.placeholder ?? 'Search');
  });

  // ── scroll listener (only when sticky + glass both true) ───────────────

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    if (!this.glassEnabled()) return;
    this.isScrolled.set(window.scrollY > this.heightPx());
  }

  // ── event handlers ─────────────────────────────────────────────────────

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open) => !open);
  }

  protected onSearchClick(): void {
    const cfg = this.config().rightZone.globalSearch;
    if (cfg?.commandPaletteMode) {
      this.navAction.emit({ source: 'menu', actionKey: 'search.commandPalette' });
    } else {
      this.searched.emit({ query: '' });
    }
  }

  protected onAiClick(): void {
    const cfg = this.config().rightZone.aiAssistant;
    if (cfg) this.navAction.emit({ source: 'aiAssistant', actionKey: cfg.actionKey });
  }

  protected onMessageClick(n: NavNotification): void {
    this.navAction.emit({ source: 'message', actionKey: 'messages.open', payload: { id: n.id } });
  }

  protected onNotificationClick(n: NavNotification): void {
    this.navAction.emit({ source: 'notification', actionKey: 'notifications.open', payload: { id: n.id } });
  }

  protected onHelpClick(): void {
    const cfg = this.config().rightZone.help;
    if (cfg?.docsUrl) {
      window.open(cfg.docsUrl, '_blank', 'noopener,noreferrer');
    } else {
      this.navAction.emit({ source: 'help', actionKey: 'help.open' });
    }
  }

  protected onLanguageChanged(lang: { code: string; label: string }): void {
    this.navAction.emit({ source: 'menu', actionKey: 'language.change', payload: { code: lang.code } });
  }

  protected onMobileNavAction(e: NavActionEvent): void {
    this.isMobileMenuOpen.set(false);
    this.navAction.emit(e);
  }
}
