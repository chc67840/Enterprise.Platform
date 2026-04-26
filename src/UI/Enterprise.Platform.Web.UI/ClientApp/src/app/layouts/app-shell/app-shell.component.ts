/**
 * ─── APP SHELL ──────────────────────────────────────────────────────────────────
 *
 * WHY
 *   The primary chrome wrapping every authenticated page. Hosts:
 *
 *     1. **Top navigation** — `TopNavWithSidebarComponent` (Variant B) is the
 *        default for healthcare/finance/HR domains: app bar + collapsible
 *        side drawer for deep menus. Swap to `TopNavHorizontalComponent` or
 *        `TopNavCompactComponent` for a different domain feel without
 *        touching anything else in the shell.
 *     2. **Single global toast outlet** — `<p-toast>` mounted once here means
 *        every `MessageService.add(...)` call renders in the same place, no
 *        matter which feature emits it.
 *     3. **Single global confirm outlet** — `<p-confirmdialog>` for
 *        programmatic confirmation modals via `ConfirmationService`.
 *     4. **Router outlet** — where the feature route tree mounts.
 *
 * NAVIGATION DATA SOURCE
 *   Items come from `MenuConfigService` (signal-backed). Today the service
 *   ships a hard-coded constant; tomorrow it'll be backed by the BFF's
 *   `/api/v1/me/navigation` response. The shell stays unchanged through the
 *   swap — variants only see the resulting `Signal<readonly NavMenuItem[]>`.
 *
 * RIGHT-SIDE ACTIONS
 *   - User menu — fully wired inside `UserMenuComponent` (auth + theme).
 *   - Notifications — bell + popover, wired to mock data; click events
 *     bubble up here for routing decisions.
 *   - Apps + Search — emit events; not yet wired to anything since the
 *     command palette / app switcher haven't been built. Hooks are in
 *     place so Phase 8+ work doesn't touch the shell again.
 *
 * TOAST CONFIGURATION
 *   `<p-toast position="top-right">` — top-right is industry standard for
 *   transient notifications. `preventOpenDuplicates="true"` avoids stacking
 *   identical messages (e.g. when a flaky network produces repeat 5xx retries).
 *
 * SESSION-EXPIRING DIALOG (Phase 2.4)
 *   Rendered via `@defer (when session.expiringSoon())` so `primeng/dialog`
 *   + `primeng/button` stay OUT of the initial bundle. The chunk loads on
 *   first trigger of the warning window — a non-hot path, so the ~160 kB
 *   deferred cost is paid exactly once per authenticated session and never
 *   in prod builds where the user acts on the dialog before expiry.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { SessionMonitorService } from '@core/auth';
import { LoggerService } from '@core/services';
import { GlobalProgressBarComponent } from '@shared/components/global-progress-bar/global-progress-bar.component';
import { SessionExpiringDialogComponent } from '@shared/components/session-expiring-dialog/session-expiring-dialog.component';
import {
  MenuConfigService,
  type NavBranding,
  type NavNotification,
  TopNavWithSidebarComponent,
} from '@shared/components/navigation';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `SessionExpiringDialogComponent` is imported here but used ONLY inside the
  // `@defer` block below. Angular's compiler detects the exclusive-defer usage
  // and emits a dynamic import for the component + its PrimeNG Dialog/Button
  // dependencies, keeping them out of the initial chunk.
  imports: [
    RouterOutlet,
    ToastModule,
    ConfirmDialogModule,
    GlobalProgressBarComponent,
    SessionExpiringDialogComponent,
    TopNavWithSidebarComponent,
  ],
  template: `
    <div class="flex min-h-screen flex-col bg-[color:var(--ep-surface-50)]">
      <!-- Phase 5.4 — thin top progress bar driven by LoadingService. -->
      <app-global-progress-bar />

      <app-top-nav-with-sidebar
        [branding]="branding()"
        [items]="navItems()"
        [showNotifications]="true"
        (notificationClick)="onNotificationClick($event)"
        (profileClick)="onProfileClick()"
        (settingsClick)="onSettingsClick()"
        (searchClick)="onSearchClick()"
        (appsClick)="onAppsClick()"
      />

      <main
        class="mx-auto w-full max-w-[var(--ep-content-max)] flex-1 px-4 py-6 sm:px-6"
        role="main"
        id="main-content"
      >
        <router-outlet />
      </main>

      <!-- Global toast host — owned by this shell, dispatched via MessageService. -->
      <p-toast position="top-right" [preventOpenDuplicates]="true" />

      <!-- Global confirm host — owned by this shell, dispatched via ConfirmationService. -->
      <p-confirmdialog />

      @defer (when session.expiringSoon()) {
        <!--
          Phase 2.4 — session-expiry warning dialog. Lazy-loaded via @defer so
          the PrimeNG Dialog + Button modules do NOT pollute the initial bundle;
          the chunk downloads the first time the warning window opens.
        -->
        <app-session-expiring-dialog />
      }
    </div>
  `,
})
export class AppShellComponent {
  private readonly menuConfig = inject(MenuConfigService);
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);

  /** Exposed so the @defer trigger expression can read it. */
  readonly session = inject(SessionMonitorService);

  /** Branding payload. Constant for the single-tenant app. */
  readonly branding = computed<NavBranding>(() => ({
    productName: 'Enterprise Platform',
    productSubLabel: 'Workspace',
    logoIcon: 'pi pi-bolt',
    homeRouterLink: '/dashboard',
  }));

  /** Live menu items — re-renders when permissions hydrate or tenant changes. */
  readonly navItems = this.menuConfig.items;

  // ── EVENT HANDLERS ────────────────────────────────────────────────────────

  /**
   * Handles a notification click. The placeholder behaviour just logs; once
   * notification payloads carry a deep-link URL we'll route here.
   */
  onNotificationClick(n: NavNotification): void {
    this.log.info('shell.notification.clicked', { id: n.id, title: n.title });
  }

  onProfileClick(): void {
    void this.router.navigateByUrl('/profile');
  }

  onSettingsClick(): void {
    void this.router.navigateByUrl('/settings');
  }

  /**
   * Search and apps are placeholders for the command palette and app switcher
   * (both arrive in later phases). Wired now so the chrome doesn't have to
   * change when the real implementations land.
   */
  onSearchClick(): void {
    this.log.info('shell.search.requested');
  }

  onAppsClick(): void {
    this.log.info('shell.apps.requested');
  }
}
