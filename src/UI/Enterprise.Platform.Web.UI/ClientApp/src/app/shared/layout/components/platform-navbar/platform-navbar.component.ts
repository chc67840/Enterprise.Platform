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
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
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
              <!--
                Intentionally NO width / height HTML attributes — those lock
                the rendered box to a square and crush horizontal logos
                (the SVG's own viewBox aspect is the source of truth). CSS
                pins height + lets width follow the SVG's natural aspect.
              -->
              <img
                [src]="config().leftZone.logo.imageSrc!"
                [alt]="config().leftZone.logo.alt"
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
            <!--
              Decorative status indicator. The visible glyph already conveys
              the environment to sighted users; assistive tech doesn't need
              to navigate to a non-interactive label, so aria-hidden plus
              pointer-events:none keeps it out of both the tab order and
              the click event chain.
            -->
            <span
              class="ep-env-badge"
              [attr.data-env]="config().leftZone.logo.envBadge"
              aria-hidden="true"
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
            <app-nav-clock class="ep-navbar__show-xl" [config]="config().rightZone.clock!" />
          }

          @if (config().rightZone.marketStatus?.enabled) {
            <span
              class="ep-status-pill ep-navbar__show-xl"
              [class.ep-status-pill--positive]="marketOpen()"
              [class.ep-status-pill--negative]="!marketOpen()"
            >
              <span class="ep-status-pill__dot" [class.ep-status-pill__dot--pulse]="marketOpen()"></span>
              <span>Markets {{ marketOpen() ? 'open' : 'closed' }}</span>
            </span>
          }

          @if (config().rightZone.shiftStatus?.enabled) {
            <span
              class="ep-status-pill ep-navbar__show-xl"
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
              class="ep-icon-btn ep-navbar__hide-md"
              [pTooltip]="searchTooltip()"
              tooltipPosition="bottom"
              [attr.aria-label]="config().rightZone.globalSearch!.placeholder ?? 'Open search'"
              (click)="onSearchClick($event)"
            >
              <i class="pi pi-search" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.aiAssistant?.enabled) {
            <button
              type="button"
              class="ep-icon-btn ep-icon-btn--accent ep-navbar__hide-md"
              [pTooltip]="config().rightZone.aiAssistant!.label ?? 'AI assistant'"
              tooltipPosition="bottom"
              [attr.aria-label]="config().rightZone.aiAssistant!.label ?? 'Open AI assistant'"
              (click)="onAiClick($event)"
            >
              <i [class]="(config().rightZone.aiAssistant!.icon ?? 'pi pi-sparkles')" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.quickActions?.enabled) {
            <app-quick-actions
              class="ep-navbar__hide-md"
              [config]="config().rightZone.quickActions!"
              (action)="navAction.emit($event)"
            />
          }

          @if (config().rightZone.messages?.enabled) {
            <app-notification-bell
              class="ep-navbar__hide-md"
              [config]="config().rightZone.messages!"
              [notifications]="messageItems()"
              heading="Messages"
              tone="dark"
              (itemClick)="onMessageClick($event)"
            />
          }

          @if (config().rightZone.notifications?.enabled) {
            <app-notification-bell
              class="ep-navbar__hide-sm"
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
              class="ep-icon-btn ep-navbar__hide-md"
              [pTooltip]="config().rightZone.help!.label ?? 'Help'"
              tooltipPosition="bottom"
              aria-label="Open help"
              (click)="onHelpClick($event)"
            >
              <i [class]="config().rightZone.help!.icon ?? 'pi pi-question-circle'" aria-hidden="true"></i>
            </button>
          }

          @if (config().rightZone.themeToggle?.enabled) {
            <app-theme-toggle-button
              class="ep-navbar__show-xl"
              [config]="config().rightZone.themeToggle!"
              tone="dark"
            />
          }

          @if (config().rightZone.languageSwitcher?.enabled) {
            <app-language-switcher
              class="ep-navbar__hide-md"
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
            #hamburgerBtn
            type="button"
            class="ep-icon-btn ep-hamburger"
            [attr.aria-expanded]="isMobileMenuOpen()"
            aria-controls="ep-mobile-menu"
            [attr.aria-label]="isMobileMenuOpen() ? 'Close navigation menu' : 'Open navigation menu'"
            (click)="toggleMobileMenu($event)"
          >
            <i class="pi" [class.pi-bars]="!isMobileMenuOpen()" [class.pi-times]="isMobileMenuOpen()" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </nav>

    <!--
      Mobile drawer — @if-mounted (NOT CSS-toggled).
      Removing the drawer from the DOM when closed kills three classes of bug:
        a) duplicate <nav> landmarks announced by screen readers
        b) hidden tab stops the user can still reach via keyboard
        c) click-outside listeners firing against an invisible-but-present element

      Layout: full-height side panel (left edge → max 320px or 85vw). The
      remaining 15%+ of the viewport stays uncovered so a backdrop tap can
      dismiss the drawer — non-negotiable mobile UX pattern.
    -->
    @if (isMobileMenuOpen()) {
      <div
        class="ep-mobile-backdrop"
        (click)="closeMobileMenu()"
        aria-hidden="true"
      ></div>
      <div
        #mobileDrawer
        id="ep-mobile-menu"
        class="ep-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabindex="-1"
        (keydown.tab)="onDrawerTab($event)"
        (keydown.shift.tab)="onDrawerShiftTab($event)"
      >
        <app-nav-menu
          [config]="config().centerZone.menu"
          tone="light"
          layout="vertical"
          (action)="onMobileNavAction($event)"
        />
      </div>
    }
  `,
  styleUrl: './platform-navbar.component.scss',
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

  @ViewChild('hamburgerBtn') private readonly hamburgerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileDrawer') private readonly mobileDrawer?: ElementRef<HTMLDivElement>;

  /**
   * Focus management for the mobile drawer (WCAG 2.4.3 + 2.4.7):
   *   - On open: capture the trigger so we can return focus on close, then
   *     move focus to the first focusable element inside the drawer.
   *   - On close: restore focus to the trigger (the hamburger).
   *
   * Wrapped in queueMicrotask so the @if-mounted drawer's host element is
   * actually in the DOM before we try to query it.
   */
  private restoreFocusTo: HTMLElement | null = null;
  private readonly _focusManager = effect(() => {
    const open = this.isMobileMenuOpen();
    queueMicrotask(() => {
      if (open) {
        this.restoreFocusTo = (document.activeElement as HTMLElement) ?? null;
        const first = this.mobileDrawer?.nativeElement.querySelector<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])',
        );
        (first ?? this.mobileDrawer?.nativeElement)?.focus();
      } else if (this.restoreFocusTo) {
        this.restoreFocusTo.focus();
        this.restoreFocusTo = null;
      }
    });
  });

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

  protected toggleMobileMenu(event?: Event): void {
    /*
     * stopPropagation is the ONE-LINE FIX for the "hamburger needs 4 taps"
     * bug class: without it the same click that opens the drawer continues
     * propagating, can trigger any document-level listener (PrimeNG popovers,
     * future tour-step overlays, etc.) and may immediately close what we
     * just opened. Stopping the bubble here scopes the event to the toggle.
     */
    event?.stopPropagation();
    this.isMobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  /**
   * Global Escape closes the mobile drawer. WCAG 2.1.2 — keyboard users
   * must have an unconditional "back out" affordance from any modal-like
   * surface. We listen on document so focus can be anywhere when Escape
   * fires (including inside the drawer's nav items).
   */
  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
    }
  }

  /**
   * Focus trap — when Tab reaches the last focusable in the drawer, loop
   * to the first; symmetric handler below for Shift-Tab. Keeps keyboard
   * focus inside the modal-like dialog while it's open.
   */
  protected onDrawerTab(event: Event): void {
    const focusables = this.drawerFocusables();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onDrawerShiftTab(event: Event): void {
    const focusables = this.drawerFocusables();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  }

  private drawerFocusables(): HTMLElement[] {
    const root = this.mobileDrawer?.nativeElement;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  protected onSearchClick(event?: Event): void {
    event?.stopPropagation();
    const cfg = this.config().rightZone.globalSearch;
    if (cfg?.commandPaletteMode) {
      this.navAction.emit({ source: 'menu', actionKey: 'search.commandPalette' });
    } else {
      this.searched.emit({ query: '' });
    }
  }

  protected onAiClick(event?: Event): void {
    event?.stopPropagation();
    const cfg = this.config().rightZone.aiAssistant;
    if (cfg) this.navAction.emit({ source: 'aiAssistant', actionKey: cfg.actionKey });
  }

  protected onMessageClick(n: NavNotification): void {
    this.navAction.emit({ source: 'message', actionKey: 'messages.open', payload: { id: n.id } });
  }

  protected onNotificationClick(n: NavNotification): void {
    this.navAction.emit({ source: 'notification', actionKey: 'notifications.open', payload: { id: n.id } });
  }

  protected onHelpClick(event?: Event): void {
    event?.stopPropagation();
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
