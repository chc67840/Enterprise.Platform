/**
 * ─── APP SHELL ──────────────────────────────────────────────────────────────────
 *
 * WHY
 *   The primary chrome wrapping every authenticated page. Hosts:
 *
 *     1. **Single global toast outlet** — `<p-toast>` mounted once here means
 *        every `MessageService.add(...)` call renders in the same place, no
 *        matter which feature emits it.
 *     2. **Single global confirm outlet** — `<p-confirmdialog>` for
 *        programmatic confirmation modals via `ConfirmationService`.
 *     3. **Router outlet** — where the feature route tree mounts.
 *
 * PHASE 1 SCOPE
 *   Minimal: just a top header strip with logout + the toast/confirm hosts +
 *   the router outlet. The full sidebar / navigation / theme toggle lands in
 *   Phase 5 when the design system + full nav story arrive.
 *
 *   Keeping Phase-1 AppShell minimal has two benefits:
 *     - smaller initial bundle — `SidebarNavComponent` and all its PrimeNG
 *       dependencies don't load until they exist;
 *     - exercising the auth flow doesn't depend on any future Phase-5 work.
 *
 * TOAST CONFIGURATION
 *   `<p-toast position="top-right">` — top-right is industry standard for
 *   transient notifications. `preventOpenDuplicates="true"` avoids stacking
 *   identical messages (e.g. when a flaky network produces repeat 5xx retries).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <div class="flex min-h-screen flex-col bg-gray-50">
      <header class="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div class="mx-auto flex max-w-7xl items-center justify-between">
          <h1 class="text-lg font-semibold tracking-tight text-gray-900">Enterprise Platform</h1>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-600">{{ auth.displayName() || auth.email() }}</span>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              (click)="auth.logout()"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div class="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <router-outlet />
      </div>

      <!-- Global toast host — owned by this shell, dispatched via MessageService. -->
      <p-toast position="top-right" [preventOpenDuplicates]="true" />

      <!-- Global confirm host — owned by this shell, dispatched via ConfirmationService. -->
      <p-confirmdialog />
    </div>
  `,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
}
