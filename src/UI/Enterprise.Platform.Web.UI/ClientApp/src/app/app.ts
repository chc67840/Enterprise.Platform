/**
 * ─── ROOT APP COMPONENT ─────────────────────────────────────────────────────────
 *
 * Responsibilities:
 *   1. Mount the router outlet where layouts and features attach.
 *   2. Gate the UI behind `AuthService.isLoading()` during MSAL bootstrap so
 *      no flash of protected content appears before the redirect callback
 *      finishes processing.
 *
 * MSAL BOOTSTRAP ORDER
 *   - `provideAppInitializer(initializeMsal)` in `app.config.ts` awaits
 *     `msal.initialize()` + `handleRedirectPromise()` before Angular finishes
 *     bootstrap. By the time THIS component renders, MSAL is ready.
 *   - But: `AuthService.isLoading` stays `true` until
 *     `MsalBroadcastService.inProgress$` emits `InteractionStatus.None`. That
 *     last flip happens microseconds later. We use it as the UI gate.
 *
 * ZONELESS + ONPUSH
 *   This component runs under `ChangeDetectionStrategy.OnPush` with zoneless
 *   change detection. Signal reads in the template trigger re-render; no
 *   `ChangeDetectorRef.markForCheck()` needed.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

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
}
