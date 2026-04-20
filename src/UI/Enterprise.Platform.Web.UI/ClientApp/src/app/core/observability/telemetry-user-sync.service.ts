/**
 * ─── TELEMETRY USER SYNC ────────────────────────────────────────────────────────
 *
 * WHY
 *   A tiny coordinator that forwards the authenticated user's id from
 *   `AuthService` into `TelemetryService.setUserContext()`. Lives here
 *   (instead of inside either service) to break what would otherwise be a
 *   circular DI graph:
 *
 *     AuthService  ──injects──▶ TelemetryService (to report events)
 *     TelemetryService ──injects──▶ AuthService (to read userId)
 *
 *   Angular would throw `NG0200: Circular dependency in DI`. The coordinator
 *   depends on both, but nothing depends on it — breaking the cycle.
 *
 * HOW IT'S WIRED
 *   `app.config.ts` registers it via `provideAppInitializer(() =>
 *   inject(TelemetryUserSyncService))`. Touching the service during boot
 *   triggers its constructor; the `effect` inside registers the sync and
 *   keeps running until app teardown.
 */
import { Injectable, effect, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';

import { TelemetryService } from './telemetry.service';

@Injectable({ providedIn: 'root' })
export class TelemetryUserSyncService {
  private readonly auth = inject(AuthService);
  private readonly telemetry = inject(TelemetryService);

  constructor() {
    effect(() => {
      // `currentUser` is a computed signal — the effect re-runs whenever the
      // active MSAL account (and therefore the user id) changes.
      const user = this.auth.currentUser();
      this.telemetry.setUserContext(user?.id ?? null);
    });
  }
}
