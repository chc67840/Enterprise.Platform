/**
 * ─── AUTH SERVICE (BFF Cookie-Session, Signal-Based) ───────────────────────────
 *
 * WHY
 *   A thin, signal-based facade over the BFF's cookie-session auth so:
 *
 *     1. Components never talk to the OIDC handler directly — they see a
 *        stable `AuthService` contract (identical public shape to the old
 *        MSAL-backed version, so feature code didn't change during Phase-9
 *        cutover).
 *     2. Login / logout / current-user state is exposed as signals for
 *        zoneless change detection + natural template bindings.
 *     3. Permission hydration is triggered automatically on sign-in (see
 *        `AuthStore.hydrate()`), so guards never race the effective-
 *        permissions fetch.
 *
 * HOW AUTH WORKS POST-PHASE-9
 *   - The browser NEVER sees an access token. The BFF runs OIDC code + PKCE
 *     against Entra server-side, stashes tokens in a HttpOnly session cookie,
 *     and attaches a bearer to downstream Api calls via `BffProxyController`.
 *   - `login()` is a **top-level navigation** to `/api/auth/login` — we leave
 *     the SPA so the browser follows Entra's redirects and lands back on our
 *     origin with a session cookie set. Top-level (not XHR) is critical —
 *     cross-origin redirects silently drop cookie writes on XHR.
 *   - `logout()` posts to `/api/auth/logout` and follows the 302 to Entra's
 *     end-session endpoint, which returns the browser to our BFF (which
 *     clears the cookie and redirects to the landing page).
 *   - `refreshSession()` calls `GET /api/auth/session` — the BFF returns
 *     `{ isAuthenticated, name, email, roles, expiresAt }`. This replaces
 *     MSAL's `inProgress$` polling and is also the single proof-of-life call
 *     `SessionMonitorService` makes on its tick.
 *
 * PROVIDED IN: root (singleton — one instance per app).
 */
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from '@core/auth/auth.store';
import { SessionMonitorService } from '@core/auth/session-monitor.service';
import type { CurrentUser } from '@core/models';
import { LoggerService } from '@core/services/logger.service';

/** BroadcastChannel name used to sync logout events across open tabs. */
const LOGOUT_CHANNEL = 'ep:auth';
const LOGOUT_MESSAGE = 'logout';

/**
 * JSON contract returned by `GET /api/auth/session`. Mirrors the C#
 * `SessionInfo` record in `Enterprise.Platform.Web.UI.Controllers.AuthController`.
 * Kept narrow — the SPA has no business reading tokens, TIDs, or refresh
 * metadata; that all stays server-side.
 */
interface SessionInfo {
  readonly isAuthenticated: boolean;
  readonly name: string | null;
  readonly email: string | null;
  readonly roles: readonly string[];
  /** ISO-8601 timestamp of cookie expiration, or `null` when anonymous. */
  readonly expiresAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly authStore = inject(AuthStore);
  private readonly sessionMonitor = inject(SessionMonitorService);
  private readonly destroyRef = inject(DestroyRef);

  // ── PUBLIC SIGNALS (reactive auth state) ─────────────────────────────────

  /**
   * Current session info from the BFF, or `null` when anonymous. Components
   * should bind to the derived `currentUser` signal below instead of this.
   */
  private readonly _session = signal<SessionInfo | null>(null);

  /** Is the initial session fetch in flight? */
  readonly isLoading = signal<boolean>(true);

  /** Expiry instant surfaced for `SessionMonitorService` — ms since epoch, or `null`. */
  readonly expiresAt = computed<number | null>(() => {
    const raw = this._session()?.expiresAt ?? null;
    if (!raw) return null;
    const ts = Date.parse(raw);
    return Number.isNaN(ts) ? null : ts;
  });

  /** Convenient projection into the app-facing `CurrentUser` shape. */
  readonly currentUser = computed<CurrentUser | null>(() => {
    const s = this._session();
    if (!s || !s.isAuthenticated) return null;
    return {
      displayName: s.name ?? '',
      email: s.email ?? '',
    };
  });

  /** Whether the user is currently authenticated. */
  readonly isAuthenticated = computed(() => this._session()?.isAuthenticated === true);

  /** Convenience signals for chrome bindings. */
  readonly displayName = computed(() => this.currentUser()?.displayName ?? '');
  readonly email = computed(() => this.currentUser()?.email ?? '');

  /**
   * Roles from the BFF's session response — coarse labels. Components doing
   * UX gating should prefer `permissions()` from `AuthStore` (authoritative,
   * hydrated from the backend).
   */
  readonly roles = computed<readonly string[]>(() => this._session()?.roles ?? []);

  constructor() {
    this.subscribeToCrossTabLogout();
    this.triggerHydrationOnLogin();
  }

  // ── INITIALIZATION ───────────────────────────────────────────────────────

  /**
   * Fetches `/api/auth/session` and populates signals. Invoked by the
   * `provideAppInitializer` hook in `app.config.ts` so the first render
   * already knows whether the user is authenticated — no flicker between
   * "loading" and "login required".
   *
   * Tolerant of network errors: when the BFF is unreachable, we log and
   * treat the user as anonymous rather than throwing (which would block app
   * bootstrap). Subsequent requests' interceptors surface the real failure.
   */
  async refreshSession(): Promise<void> {
    try {
      const session = await firstValueFrom(
        this.http.get<SessionInfo>('/api/auth/session', {
          withCredentials: true,
        }),
      );
      this._session.set(session);
      this.log.info('auth.session.loaded', {
        isAuthenticated: session.isAuthenticated,
      });
    } catch (err: unknown) {
      this.log.warn('auth.session.load.failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      this._session.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ── AUTH OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Starts the Entra login flow via a top-level navigation to the BFF. The
   * browser follows `302 → Entra authorize → sign-in → Entra redirect → BFF
   * /signin-oidc → session cookie set → 302 to returnUrl`. The SPA restarts
   * at `returnUrl` with a valid session cookie.
   *
   * MUST be a top-level navigation (not XHR) — cross-origin redirects silently
   * drop `Set-Cookie` when initiated from XHR even with `credentials: 'include'`.
   *
   * @param returnUrl Optional local path to land on after login (default `/`).
   */
  login(returnUrl?: string): void {
    const target = this.buildAuthUrl('/api/auth/login', returnUrl);
    this.log.info('auth.login.start', { returnUrl });
    // Top-level navigation leaves the SPA — the browser handles the redirect chain.
    window.location.href = target;
  }

  /**
   * Clears the local session signal, broadcasts to other tabs, then posts to
   * `/api/auth/logout` as a top-level form submit so the browser follows the
   * 302 through Entra's end-session endpoint. Same top-level-nav reasoning
   * as `login()`.
   *
   * @param returnUrl Optional local path to land on after logout completes.
   */
  logout(returnUrl?: string): void {
    this.log.info('auth.logout.start');

    // 1. Clear local state immediately so the UI doesn't render stale data
    //    during the redirect chain.
    this._session.set(null);
    this.authStore.reset();
    this.sessionMonitor.stop();

    // 2. Tell other tabs to clear their state too.
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(LOGOUT_CHANNEL).postMessage(LOGOUT_MESSAGE);
      }
    } catch {
      // BroadcastChannel unavailable (older browsers, strict security contexts).
      // Non-fatal; the server-side sign-out still clears THIS tab.
    }

    // 3. Top-level POST to the BFF. Build a transient <form> because POST
    //    requires it (a plain `window.location.href = 'POST…'` isn't a thing).
    const target = this.buildAuthUrl('/api/auth/logout', returnUrl);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = target;
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  /**
   * Builds a BFF auth URL with a validated `returnUrl` query string. The BFF
   * validates it again server-side via `Url.IsLocalUrl`, but validating
   * client-side prevents a round-trip for obvious-nonsense inputs.
   */
  private buildAuthUrl(path: string, returnUrl?: string): string {
    if (!returnUrl) return path;
    // Open-redirect defense mirrors the BFF: only allow paths starting with
    // `/` (not `//` — protocol-relative), not containing backslashes.
    const safe =
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.includes('\\')
        ? returnUrl
        : '/';
    return `${path}?returnUrl=${encodeURIComponent(safe)}`;
  }

  /**
   * Listens for `logout` messages on the shared channel. When another tab
   * logs out, we clear our local state too so the user isn't left with a
   * zombie authenticated UI in this tab.
   */
  private subscribeToCrossTabLogout(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.onmessage = (evt): void => {
      if (evt.data === LOGOUT_MESSAGE) {
        this._session.set(null);
        this.authStore.reset();
        this.sessionMonitor.stop();
      }
    };
    this.destroyRef.onDestroy(() => channel.close());
  }

  /**
   * Reactive hydration: every time `isAuthenticated()` becomes `true`, fire
   * `AuthStore.hydrate()` + start the session monitor.
   *
   * `untracked(() => ...)` prevents the effect from re-registering on
   * permission-state changes — we only care about the `isAuthenticated`
   * transition.
   */
  private triggerHydrationOnLogin(): void {
    effect(
      () => {
        const authed = this.isAuthenticated();
        if (authed) {
          untracked(() => {
            this.authStore.hydrate();
            // Idempotent — safe to call on every transition.
            this.sessionMonitor.start();
          });
        }
      },
      { manualCleanup: false },
    );
  }
}
