/**
 * ─── SESSION MONITOR SERVICE ────────────────────────────────────────────────────
 *
 * WHY
 *   Users on long-lived tabs hit an auth-token expiry every ~15 minutes.
 *   Surfacing this as a timed warning (rather than a surprise 401 mid-action)
 *   is a core enterprise-app expectation:
 *
 *     - At `exp - warningLeadTimeSeconds` (default 120 s), `expiringSoon` flips
 *       to `true` — the UI shows a modal offering "Stay signed in" or
 *       "Sign out".
 *     - At `exp`, `expired` flips to `true` — the next outbound request will
 *       trip MSAL silent-refresh; if that fails, the `errorInterceptor`
 *       already owns the redirect back to `/auth/login`.
 *     - When the tab returns to the foreground (`visibilitychange`), we
 *       re-compute from the current active account so a tab that was
 *       suspended past expiry immediately reflects the expired state instead
 *       of waiting for the next poll tick.
 *
 * WHERE `exp` COMES FROM
 *   MSAL exposes the decoded id token on `AccountInfo.idTokenClaims`. The
 *   JWT spec guarantees `exp` as a number of seconds since epoch. We multiply
 *   by 1000 to work in milliseconds throughout this service.
 *
 * INTERACTIONS WITH THE REST OF THE SYSTEM
 *   - `AuthService` triggers `start()` when the user becomes authenticated
 *     and `stop()` on logout. The service's effects handle the rest.
 *   - `SessionExpiringDialogComponent` binds to `expiringSoon()` /
 *     `secondsUntilExpiry()` to render the warning. "Stay" calls `renew()`;
 *     "Sign out" calls `AuthService.logout()` directly.
 *   - `renew()` uses MSAL's `acquireTokenSilent` with the default login
 *     scopes — successful refresh resets the timer.
 *
 * PROVIDED IN: root. Exactly one monitor for the whole tab.
 */
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import type { AccountInfo } from '@azure/msal-browser';

import { RUNTIME_CONFIG } from '@config/runtime-config';
import { LoggerService } from '@core/services/logger.service';
import { NotificationService } from '@core/services/notification.service';

/** Default scopes for silent renewal — matches `AuthService.login`. */
const RENEW_SCOPES: readonly string[] = ['openid', 'profile', 'User.Read'];

@Injectable({ providedIn: 'root' })
export class SessionMonitorService {
  private readonly msal = inject(MsalService);
  private readonly log = inject(LoggerService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(RUNTIME_CONFIG);

  /** Poll handle — `null` means the monitor is stopped. */
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private visibilityListener: (() => void) | null = null;

  // ── Reactive state ────────────────────────────────────────────────────

  /**
   * Epoch milliseconds at which the current id token expires. `null` when no
   * account is active (pre-login or post-logout).
   */
  private readonly _expiresAt = signal<number | null>(null);

  /** Last tick — drives re-computation of `secondsUntilExpiry`. */
  private readonly _now = signal<number>(Date.now());

  /** Whole seconds remaining until expiry. `null` when no active account. */
  readonly secondsUntilExpiry = computed<number | null>(() => {
    const exp = this._expiresAt();
    if (exp === null) return null;
    return Math.max(0, Math.floor((exp - this._now()) / 1000));
  });

  /**
   * `true` in the warning window — i.e. less than `warningLeadTimeSeconds`
   * remaining but still positive. `false` before and after.
   */
  readonly expiringSoon = computed<boolean>(() => {
    const secs = this.secondsUntilExpiry();
    if (secs === null) return false;
    return secs > 0 && secs <= this.runtime.session.warningLeadTimeSeconds;
  });

  /** `true` iff the token has already expired and no refresh has landed yet. */
  readonly expired = computed<boolean>(() => {
    const secs = this.secondsUntilExpiry();
    return secs !== null && secs <= 0;
  });

  constructor() {
    // When the token expires without a successful silent refresh, surface a
    // sticky toast so the user understands why the next action will bounce
    // them to the login page. The `errorInterceptor` handles the hard
    // redirect; this is the advisory.
    effect(() => {
      if (this.expired()) {
        this.log.warn('session.expired');
        this.notify.sticky(
          'warn',
          'Session expired',
          'Please sign in again to continue.',
        );
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Begins polling. Idempotent. Called by `AuthService` once the first
   * authenticated state is observed. Pulling the monitor start out of the
   * service constructor means pre-login ticks don't churn when the app is
   * still booting.
   */
  start(): void {
    if (this.pollHandle !== null) {
      return;
    }

    this.refreshExpiryFromMsal();

    const intervalMs = this.runtime.session.pollIntervalSeconds * 1000;
    this.pollHandle = setInterval(() => {
      this._now.set(Date.now());
      // Re-read expiry each tick — MSAL may have silently refreshed the token
      // in the background, extending the deadline.
      this.refreshExpiryFromMsal();
    }, intervalMs);

    if (typeof document !== 'undefined') {
      const listener = (): void => {
        if (document.visibilityState === 'visible') {
          this._now.set(Date.now());
          this.refreshExpiryFromMsal();
        }
      };
      document.addEventListener('visibilitychange', listener);
      this.visibilityListener = listener;
    }

    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Stops polling + clears state. Called on logout. */
  stop(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.visibilityListener !== null && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    this._expiresAt.set(null);
  }

  /**
   * "Stay signed in" action — silently acquires a new access token for the
   * default scopes and re-reads the expiry. Returns `true` on success, `false`
   * if MSAL fell back to interactive (in which case the current page is
   * about to unmount anyway).
   */
  async renew(): Promise<boolean> {
    const account = this.activeAccount();
    if (!account) {
      return false;
    }

    try {
      const result = await this.msal.instance.acquireTokenSilent({
        scopes: [...RENEW_SCOPES],
        account,
        // `forceRefresh: true` is NOT set — we want MSAL's cache-first
        // behaviour; we're refreshing proactively, not because the existing
        // token is known-stale.
      });
      // `expiresOn` is authoritative for the access token's lifetime; fall
      // back to id-token claims if the provider omits it.
      const exp =
        result.expiresOn?.getTime() ??
        this.expiryFromClaims(result.account) ??
        null;
      this._expiresAt.set(exp);
      this._now.set(Date.now());
      this.log.info('session.renewed');
      return true;
    } catch (err) {
      this.log.warn('session.renew.failed', { err });
      // Hand back to MSAL for interactive refresh — the current page unmounts.
      this.msal.instance.acquireTokenRedirect({ scopes: [...RENEW_SCOPES] });
      return false;
    }
  }

  // ── Internals ────────────────────────────────────────────────────────

  private refreshExpiryFromMsal(): void {
    const account = this.activeAccount();
    if (!account) {
      this._expiresAt.set(null);
      return;
    }
    const exp = this.expiryFromClaims(account);
    this._expiresAt.set(exp);
  }

  private activeAccount(): AccountInfo | null {
    const active = this.msal.instance.getActiveAccount();
    if (active) return active;
    // Fall back to the first cached account — MSAL occasionally loses the
    // "active" flag across storage migrations; being defensive here keeps the
    // monitor functioning during those edge cases.
    const all = this.msal.instance.getAllAccounts();
    return all[0] ?? null;
  }

  private expiryFromClaims(account: AccountInfo | null | undefined): number | null {
    if (!account) return null;
    const claims = account.idTokenClaims as Record<string, unknown> | undefined;
    const exp = claims?.['exp'];
    if (typeof exp !== 'number') return null;
    return exp * 1000;
  }
}
