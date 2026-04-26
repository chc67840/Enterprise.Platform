/**
 * ─── APP SHELL ──────────────────────────────────────────────────────────────────
 *
 * Hosts the canonical chrome for every authenticated route:
 *   1. global progress bar
 *   2. PlatformNavbarComponent (F.2 — config-driven)
 *   3. StatusBannerHost (system / business banners)
 *   4. <main> + <router-outlet>
 *   5. PlatformFooter (Phase E; F.5 will refit to FooterConfig)
 *   6. global toast / confirm outlets
 *   7. lazily-loaded session-expiring dialog
 *
 * Phase F.2 (2026-04-26): the navbar now consumes a `NavbarConfig` literal.
 * For the single-tenant test app the config is built locally here from the
 * existing `MenuConfigService` + a hard-coded right zone. F.6 replaces this
 * with per-domain config factories + a domain-store-driven swap.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { AuthService, AuthStore, SessionMonitorService } from '@core/auth';
import { DomainStore, LoggerService, NavbarConfigService } from '@core/services';
import { GlobalProgressBarComponent } from '@shared/components/global-progress-bar/global-progress-bar.component';
import { SessionExpiringDialogComponent } from '@shared/components/session-expiring-dialog/session-expiring-dialog.component';
import { StatusBannerHostComponent } from '@shared/components/status-banner/status-banner-host.component';
import {
  PlatformFooterV2Component,
  PlatformNavbarComponent,
  type FooterConfig,
  type NavActionEvent,
  type NavLogoutEvent,
  type NavNotification,
  type NavSearchEvent,
  type NavTenantSwitchEvent,
  type NavbarConfig,
  type UserProfile,
} from '@shared/layout';
import { DOMAIN_CHROME_REGISTRY } from '@shared/layout/domains';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ToastModule,
    ConfirmDialogModule,
    GlobalProgressBarComponent,
    SessionExpiringDialogComponent,
    PlatformNavbarComponent,
    StatusBannerHostComponent,
    PlatformFooterV2Component,
  ],
  template: `
    <div class="ep-app-shell flex min-h-screen min-w-0 flex-col bg-[color:var(--ep-surface-50)]" style="overflow-x: clip;">
      <app-global-progress-bar />

      <app-platform-navbar
        [config]="navbarConfig()"
        [userProfile]="userProfile()"
        [notifications]="notifications()"
        (navAction)="onNavAction($event)"
        (tenantSwitch)="onTenantSwitch($event)"
        (searched)="onSearched($event)"
        (logout)="onLogout($event)"
      />

      <app-status-banner-host />

      <main
        class="mx-auto w-full min-w-0 max-w-[var(--ep-content-max)] flex-1 px-4 py-6 sm:px-6"
        style="overflow-x: clip; overscroll-behavior: contain;"
        role="main"
        id="main-content"
        tabindex="-1"
      >
        <router-outlet />
      </main>

      <app-platform-footer [config]="footerConfig()" (navAction)="onNavAction($event)" />

      <p-toast position="top-right" [preventOpenDuplicates]="true" />
      <p-confirmdialog />

      @defer (when session.expiringSoon()) {
        <app-session-expiring-dialog />
      }
    </div>
  `,
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly domains = inject(DomainStore);
  private readonly chromeService = inject(NavbarConfigService);

  readonly session = inject(SessionMonitorService);

  /**
   * F.7 — chrome flows from `NavbarConfigService` (signal-backed). The
   * service hides whether the current `NAVBAR_CONFIG_PROVIDER` is the
   * static factory or a backend HTTP call. The shell never sees `null`
   * after first load — the service falls back to the static registry on
   * error.
   */
  readonly navbarConfig = computed<NavbarConfig>(() => this.chromeService.navbar());
  readonly footerConfig = computed<FooterConfig>(() => this.chromeService.footer());

  /** Adapter: AuthService signals → UserProfile shape. */
  readonly userProfile = computed<UserProfile | null>(() => {
    if (!this.authService.isAuthenticated()) return null;
    return {
      id: '',                                       // not exposed by AuthService today
      displayName: this.authService.displayName() || this.authService.email(),
      email: this.authService.email(),
      role: this.authStore.roles()[0],
    };
  });

  /** Mock notifications until BFF feed lands. */
  readonly notifications = computed<readonly NavNotification[]>(() => [
    {
      id: 'n1',
      level: 'info',
      title: 'Welcome to Enterprise Platform',
      message: 'Take a tour of your dashboard to get started.',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      read: false,
    },
    {
      id: 'n2',
      level: 'success',
      title: 'Permission updated',
      message: 'Your access to the Reports module was approved.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: false,
    },
    {
      id: 'n3',
      level: 'warning',
      title: 'Maintenance window scheduled',
      message: 'Friday 02:00–02:30 UTC. Plan accordingly.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
    },
  ]);

  // ── Single dispatcher per spec D2 ─────────────────────────────────────

  onNavAction(e: NavActionEvent): void {
    this.log.info('shell.navAction', { source: e.source, actionKey: e.actionKey, payload: e.payload });
    switch (e.actionKey) {
      case 'auth.logout':
        return this.authService.logout();
      case 'help.open':
        return void this.router.navigateByUrl('/help');
      case 'search.commandPalette':
        // Future: open a global command palette (Cmd+K). Stub for now.
        return;
      case 'language.change':
        // Future: i18n service hook.
        return;
    }
  }

  /**
   * Per spec D10: tenant switch MUST flush every tenant-scoped store before
   * the switch. Order: log → flush stores → write tenant cookie → reload.
   *
   * Today we only log (no tenant-scoped stores yet). The skeleton is here
   * so the next person who registers a tenant-scoped feature has a single
   * place to add their `.reset()` call.
   */
  onTenantSwitch(e: NavTenantSwitchEvent): void {
    this.log.info('shell.tenantSwitch', e);
    // 1. Flush tenant-scoped stores — register here as features land:
    //    inject(UsersStore).clear();
    //    inject(OrdersStore).clear();
    // 2. Persist the chosen tenant (cookie / header for the BFF):
    //    document.cookie = `ep:tenant=${e.toTenantId}; Path=/; SameSite=Lax`;
    // 3. Force a hard reload so the BFF re-resolves the tenant scope
    //    + re-issues a fresh navigation menu:
    //    window.location.assign('/');
  }

  onSearched(e: NavSearchEvent): void {
    this.log.info('shell.searched', e);
  }

  onLogout(e: NavLogoutEvent): void {
    this.log.info('shell.logout', { userId: e.userId });
    this.authService.logout();
  }
}
