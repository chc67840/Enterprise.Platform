/**
 * ─── SESSION EXPIRING DIALOG ────────────────────────────────────────────────────
 *
 * WHY
 *   The UX half of Phase 2.4. Binds to `SessionMonitorService.expiringSoon`
 *   and renders a centred PrimeNG dialog at `exp - warningLeadTimeSeconds`
 *   with two actions:
 *
 *     - "Stay signed in" → `SessionMonitorService.renew()` (silent refresh).
 *     - "Sign out"       → `AuthService.logout()`.
 *
 *   The dialog is **not dismissable by backdrop / ESC** — users shouldn't
 *   accidentally dismiss it; the choice must be explicit.
 *
 * COUNTDOWN TEXT
 *   Re-computes live from `secondsUntilExpiry()` which ticks every
 *   `session.pollIntervalSeconds` (30 s by default). We floor to whole
 *   seconds to avoid jittery half-second renders.
 *
 * LIVE REGION
 *   The countdown region uses `aria-live="polite"` so screen readers announce
 *   time updates without interrupting the user.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { AuthService, SessionMonitorService } from '@core/auth';

@Component({
  selector: 'app-session-expiring-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule],
  template: `
    <p-dialog
      [visible]="visible()"
      [modal]="true"
      [closable]="false"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="false"
      [style]="{ width: '28rem' }"
      header="Your session is about to expire"
    >
      <p class="mb-3 text-sm text-gray-700" aria-live="polite">
        You will be signed out in
        <span class="font-semibold">{{ countdown() }}</span>
        to keep your account secure.
      </p>
      <p class="text-sm text-gray-500">
        Choose "Stay signed in" to extend your session or "Sign out" to end it now.
      </p>
      <ng-template pTemplate="footer">
        <button
          pButton
          type="button"
          severity="secondary"
          label="Sign out"
          [disabled]="busy()"
          (click)="signOut()"
        ></button>
        <button
          pButton
          type="button"
          label="Stay signed in"
          [disabled]="busy()"
          (click)="stay()"
        ></button>
      </ng-template>
    </p-dialog>
  `,
})
export class SessionExpiringDialogComponent {
  private readonly session = inject(SessionMonitorService);
  private readonly auth = inject(AuthService);

  /** Reflects the monitor's `expiringSoon` signal directly. */
  readonly visible = computed(() => this.session.expiringSoon());

  /** Human-readable countdown — "1 min 42 sec" shape. */
  readonly countdown = computed(() => this.formatCountdown(this.session.secondsUntilExpiry()));

  /** Suppresses both buttons while a renewal is in flight. */
  protected readonly busy = signal(false);

  protected async stay(): Promise<void> {
    this.busy.set(true);
    try {
      await this.session.renew();
    } finally {
      this.busy.set(false);
    }
  }

  protected signOut(): void {
    this.auth.logout();
  }

  /** Tiny duration formatter — avoids pulling in date-fns for one label. */
  private formatCountdown(totalSeconds: number | null): string {
    if (totalSeconds === null || totalSeconds <= 0) return '0 sec';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} sec`;
    if (seconds === 0) return `${minutes} min`;
    return `${minutes} min ${seconds} sec`;
  }
}
