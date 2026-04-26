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
              class="ep-navbar__hide-md"
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
            type="button"
            class="ep-icon-btn ep-hamburger"
            [attr.aria-expanded]="isMobileMenuOpen()"
            aria-controls="ep-mobile-menu"
            [attr.aria-label]="isMobileMenuOpen() ? 'Close navigation menu' : 'Open navigation menu'"
            (click)="toggleMobileMenu()"
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
        id="ep-mobile-menu"
        class="ep-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
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

      /* ── navbar surface ──
       * Top corners rounded (var --ep-nav-radius-top), bottom flush so the
       * status banner / main content butt cleanly against the navbar.
       * overflow:hidden clips brand image + right-zone widgets to the
       * rounded shape; popovers/tooltips already teleport to body via
       * appendTo so they're not affected by this clip.
       */
      .ep-navbar {
        --nav-height: 64px;
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
        box-shadow: var(--ep-nav-shadow);
        border-radius: var(--ep-nav-radius-top) var(--ep-nav-radius-top) 0 0;
        overflow: hidden;
        z-index: 30;
      }
      @media print {
        .ep-navbar { border-radius: 0; box-shadow: none; }
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
        /*
         * Hard cap at 100% so an over-eager descendant (rare, but possible
         * when a third-party widget mounts a wide popover root inline) can
         * never make the row itself wider than the viewport. Combined with
         * overflow-x:hidden on main (app-shell) and min-width:0 on the
         * centre/right zones below, the page can never develop a
         * horizontal scrollbar at any breakpoint.
         */
        max-width: 100%;
        overflow-x: hidden;
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
      /*
       * Brand text + sub-text + logo are presentational children of the
       * brand <a>. Explicitly opt out of pointer events / selection so the
       * entire bounding box of the <a> is one uniform click target — no
       * "dead zone on the text side" symptom.
       */
      .ep-navbar__brand-text,
      .ep-navbar__brand-name,
      .ep-navbar__brand-sub,
      .ep-navbar__logo-img,
      .ep-navbar__logo-glyph {
        pointer-events: none;
        user-select: none;
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

      /* ── env badge — informational only, never interactive ── */
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
        pointer-events: none;
        user-select: none;
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
        min-width: 0;
      }

      /*
       * Progressive disclosure for non-essential right-zone widgets.
       *
       *   < 1024px (where the centre menu is hidden + hamburger appears)
       *     → hide search / AI / quick-actions / messages bell / help /
       *       theme-toggle / language switcher. Their affordances live in
       *       the mobile drawer or are simply non-essential at this width.
       *
       *   < 640px (true phone)
       *     → also hide notifications. Only user menu + hamburger remain.
       *
       * Class is applied DIRECTLY to the button or sub-component host
       * element (no positional <span> wrappers — those create brittle
       * nth-of-type selectors). !important is required so the rule beats
       * any sub-component :host display value (NotificationBellComponent,
       * QuickActionsComponent etc. don't set one today, but defending
       * against future drift is cheaper than another debugging round).
       */
      @media (max-width: 1023px) {
        .ep-navbar__hide-md { display: none !important; }
      }
      @media (max-width: 639px) {
        .ep-navbar__hide-sm { display: none !important; }
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
        pointer-events: none;
        user-select: none;
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

      /* icon buttons — WCAG 2.5.5 minimum 44x44 touch target */
      .ep-icon-btn {
        display: inline-flex;
        height: 2.75rem;
        width: 2.75rem;
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

      /*
       * Mobile drawer — side panel with backdrop. Only mounted via @if when
       * isMobileMenuOpen() is true, so the closed state has no DOM cost and
       * no accessibility footprint (no duplicate landmarks, no stray tab
       * stops). Slides in from the left so the right-edge backdrop region
       * is always tappable for dismissal.
       */
      .ep-mobile-backdrop {
        position: fixed;
        top: var(--nav-height);
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 25;
        background-color: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        cursor: pointer;
        animation: ep-backdrop-in 180ms ease forwards;
      }
      .ep-mobile-menu {
        position: fixed;
        top: var(--nav-height);
        left: 0;
        bottom: 0;
        z-index: 26;
        /* min(320px, 85vw) keeps a tappable backdrop region at every
         * viewport width — even down to 320px the drawer is 272px wide,
         * leaving 48px of backdrop. */
        width: min(320px, 85vw);
        background-color: var(--ep-color-neutral-50);
        border-right: 1px solid var(--ep-color-neutral-200);
        box-shadow: 6px 0 24px rgba(15, 31, 59, 0.18);
        padding: 1rem 0.75rem 2rem;
        overflow-y: auto;
        overscroll-behavior: contain;
        animation: ep-drawer-in 220ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      @keyframes ep-backdrop-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes ep-drawer-in {
        from { transform: translateX(-100%); }
        to   { transform: translateX(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ep-mobile-backdrop,
        .ep-mobile-menu { animation: none; }
      }
      @media (min-width: 1024px) {
        .ep-mobile-backdrop,
        .ep-mobile-menu { display: none; }
      }
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
