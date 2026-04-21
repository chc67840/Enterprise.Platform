/**
 * ─── ROOT APP COMPONENT ─────────────────────────────────────────────────────────
 *
 * Responsibilities:
 *   1. Mount the router outlet where layouts and features attach.
 *   2. Gate the UI behind `AuthService.isLoading()` during the initial session
 *      probe so no flash of protected content appears before we know whether
 *      we're signed in.
 *
 * SESSION BOOTSTRAP ORDER (Phase 9)
 *   - `provideAppInitializer(() => inject(AuthService).refreshSession())` in
 *     `app.config.ts` calls `GET /api/auth/session` and awaits the response
 *     before Angular finishes bootstrap. By the time THIS component renders,
 *     the session signal is populated (or `null` on network failure).
 *   - `AuthService.isLoading` flips to `false` when the initializer resolves;
 *     we gate the UI on it to avoid flicker.
 *
 * ZONELESS + ONPUSH
 *   This component runs under `ChangeDetectionStrategy.OnPush` with zoneless
 *   change detection. Signal reads in the template trigger re-render; no
 *   `ChangeDetectorRef.markForCheck()` needed.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { TelemetryUserSyncService } from '@core/observability';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    @if (auth.isLoading()) {
      <div class="flex h-screen items-center justify-center bg-gray-50">
        <div class="text-center">
          <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <p class="mt-3 text-sm text-gray-500">Authenticating…</p>
        </div>
      </div>
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);

  /*
   * Constructs `TelemetryUserSyncService` post-bootstrap. Its `effect`
   * forwards `AuthService.currentUser` → `TelemetryService.setUserContext`.
   * Assigned to a protected field so tree-shaking can't drop the
   * side-effect-only injection.
   */
  protected readonly _telemetryUserSync = inject(TelemetryUserSyncService);
}
