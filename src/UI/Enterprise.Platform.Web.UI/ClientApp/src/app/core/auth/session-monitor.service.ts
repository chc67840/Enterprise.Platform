/**
 * ─── SESSION MONITOR SERVICE (BFF Cookie-Session) ───────────────────────────────
 *
 * WHY
 *   Users on long-lived tabs hit a session-cookie expiry every ~8 hours (the
 *   cookie's sliding window). The BFF's `OnValidatePrincipal` hook silently
 *   renews the stashed access token via refresh_token — but if the refresh
 *   token itself expires (or Entra revokes it), the session invalidates and
 *   the next request returns 401.
 *
 *   Surfacing this as a timed warning (rather than a surprise 401 mid-action)
 *   is a core enterprise-app expectation:
 *
 *     - At `expiresAt - warningLeadTimeSeconds` (default 120 s),
 *       `expiringSoon()` flips to `true` — the UI shows a modal offering
 *       "Stay signed in" or "Sign out".
 *     - At `expiresAt`, `expired()` flips to `true` — any subsequent request
 *       will 401 and the `errorInterceptor` redirects back to
 *       `/api/auth/login`.
 *     - On foreground (`visibilitychange`) we re-poll so a tab suspended past
 *       expiry updates immediately rather than waiting for the next tick.
 *
 * WHERE `expiresAt` COMES FROM
 *   The BFF returns the cookie's ExpiresUtc on every `/api/auth/session`
 *   response. We read it straight from the same call. No JWT decoding
 *   client-side — the SPA never sees tokens.
 *
 * RENEWAL STRATEGY
 *   `renew()` calls `GET /api/auth/session`. That request is authenticated,
 *   so the BFF's `OnValidatePrincipal` hook fires → refresh-token rotation
 *   runs → new expiresAt returned. Any authenticated request would renew,
 *   but using `/session` avoids side-effects on real endpoints.
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
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RUNTIME_CONFIG } from '@config/runtime-config';
import { LoggerService } from '@core/services/logger.service';
import { NotificationService } from '@core/services/notification.service';

/**
 * JSON contract — mirror of the BFF's `SessionInfo`. Duplicated locally (not
 * imported from auth.service) so there's no cyclic dependency: AuthService →
 * SessionMonitorService and back.
 */
interface SessionInfo {
  readonly isAuthenticated: boolean;
  readonly name: string | null;
  readonly email: string | null;
  readonly roles: readonly string[];
  readonly expiresAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SessionMonitorService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(RUNTIME_CONFIG);

  /** Poll handle — `null` means the monitor is stopped. */
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private visibilityListener: (() => void) | null = null;

  // ── Reactive state ────────────────────────────────────────────────────

  /**
   * Epoch milliseconds at which the current BFF session cookie expires.
   * `null` pre-login or post-logout.
   */
  private readonly _expiresAt = signal<number | null>(null);

  /** Last tick — drives re-computation of `secondsUntilExpiry`. */
  private readonly _now = signal<number>(Date.now());

  /** Whole seconds remaining until expiry. `null` when no active session. */
  readonly secondsUntilExpiry = computed<number | null>(() => {
    const exp = this._expiresAt();
    if (exp === null) return null;
    return Math.max(0, Math.floor((exp - this._now()) / 1000));
  });

  /** Warning window — `warningLeadTimeSeconds` before expiry. */
  readonly expiringSoon = computed<boolean>(() => {
    const secs = this.secondsUntilExpiry();
    if (secs === null) return false;
    return secs > 0 && secs <= this.runtime.session.warningLeadTimeSeconds;
  });

  /** `true` iff the session has already expired and no renew has landed yet. */
  readonly expired = computed<boolean>(() => {
    const secs = this.secondsUntilExpiry();
    return secs !== null && secs <= 0;
  });

  constructor() {
    // Surface expiry as a sticky toast so the user understands why their
    // next action bounces them to login. `errorInterceptor` handles the
    // actual redirect; this is advisory.
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
   * Begins polling `/api/auth/session`. Idempotent. Called by `AuthService`
   * when the first authenticated state is observed.
   */
  start(): void {
    if (this.pollHandle !== null) {
      return;
    }

    void this.poll();

    const intervalMs = this.runtime.session.pollIntervalSeconds * 1000;
    this.pollHandle = setInterval(() => {
      this._now.set(Date.now());
      void this.poll();
    }, intervalMs);

    if (typeof document !== 'undefined') {
      const listener = (): void => {
        if (document.visibilityState === 'visible') {
          this._now.set(Date.now());
          void this.poll();
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
   * "Stay signed in" action — calls `/api/auth/session` which triggers the
   * BFF's `OnValidatePrincipal` refresh-token rotation (when the access
   * token is within the 5-min threshold). Returns `true` when the session
   * remains valid after the call, `false` when the BFF reported the session
   * has died (401 or `isAuthenticated: false`).
   */
  async renew(): Promise<boolean> {
    try {
      const session = await firstValueFrom(
        this.http.get<SessionInfo>('/api/auth/session', {
          withCredentials: true,
        }),
      );
      if (!session.isAuthenticated) {
        this.log.warn('session.renew.rejected', {
          reason: 'BFF reported anonymous after renew attempt',
        });
        return false;
      }
      this._expiresAt.set(this.parseExpiry(session.expiresAt));
      this._now.set(Date.now());
      this.log.info('session.renewed');
      return true;
    } catch (err) {
      this.log.warn('session.renew.failed', { err });
      return false;
    }
  }

  // ── Internals ────────────────────────────────────────────────────────

  /**
   * Shared code path for `start()`'s initial call + every `setInterval` tick
   * + every `visibilitychange → visible` transition. Updates `_expiresAt`
   * with whatever the BFF currently reports.
   */
  private async poll(): Promise<void> {
    try {
      const session = await firstValueFrom(
        this.http.get<SessionInfo>('/api/auth/session', {
          withCredentials: true,
        }),
      );
      if (!session.isAuthenticated) {
        this._expiresAt.set(null);
        return;
      }
      this._expiresAt.set(this.parseExpiry(session.expiresAt));
    } catch (err) {
      // Don't kill the monitor on a single failed poll — could be a transient
      // network blip. Leave _expiresAt alone so the UI keeps its last-known
      // state; the next successful poll (or error-interceptor 401 redirect)
      // will resolve the ambiguity.
      this.log.warn('session.poll.failed', { err });
    }
  }

  private parseExpiry(raw: string | null): number | null {
    if (!raw) return null;
    const ts = Date.parse(raw);
    return Number.isNaN(ts) ? null : ts;
  }
}
