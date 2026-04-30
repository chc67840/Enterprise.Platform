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
import { NavbarConfigService } from '@core/services/navbar-config.service';
import type { ChromeConfig } from '@shared/layout/models/nav.models';

/** BroadcastChannel name used to sync logout events across open tabs. */
const LOGOUT_CHANNEL = 'ep:auth';
const LOGOUT_MESSAGE = 'logout';

/**
 * JSON contract returned by `GET /api/auth/session`. Mirrors the C#
 * `SessionInfo` record in `Enterprise.Platform.Web.UI.Controllers.AuthController`.
 * Kept narrow — the SPA has no business reading tokens, TIDs, or refresh
 * metadata; that all stays server-side.
 *
 * Post-2026-04-29: bundled the post-login envelope. `permissions` + `chrome`
 * arrive in the same call so the shell has everything it needs to paint
 * without a chain of follow-up requests.
 */
interface SessionInfo {
  readonly isAuthenticated: boolean;
  readonly name: string | null;
  readonly email: string | null;
  readonly roles: readonly string[];
  /** Fine-grained permission strings (e.g. `users.read`). Phase 1 always empty. */
  readonly permissions: readonly string[];
  /** Navbar + footer chrome built server-side. Null when anonymous. */
  readonly chrome: ChromeConfig | null;
  /** ISO-8601 timestamp of cookie expiration, or `null` when anonymous. */
  readonly expiresAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly authStore = inject(AuthStore);
  private readonly sessionMonitor = inject(SessionMonitorService);
  private readonly chromeService = inject(NavbarConfigService);
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

  /**
   * Tracks whether the antiforgery token cookie has been issued for this
   * session. The BFF's `[AutoValidateAntiforgeryToken]` rejects mutating XHRs
   * (POST/PUT/PATCH/DELETE) without a valid `X-XSRF-TOKEN` header — and that
   * header is only present when the readable `XSRF-TOKEN` cookie exists.
   * That cookie is issued by `GET /api/antiforgery/token`; we must call it
   * once per session before any user-triggered mutation.
   */
  private antiforgeryReady = false;

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
      // `?include=chrome` opts into the heavy bundle (navbar + footer config).
      // SessionMonitorService deliberately does NOT pass this flag — its tick
      // only reads expiresAt, so the chrome blob would be wasted bandwidth on
      // every poll (multiplied across the cookie's 8h lifetime). This call
      // fires once on boot + on explicit refresh (e.g. admin grants a new
      // permission and the SPA needs the updated nav).
      //
      // `X-Skip-Loading: true` opts out of the global progress bar — auth
      // bootstrap is invisible plumbing, not user-perceived activity. Without
      // this header, every boot would flash the top progress bar.
      const session = await firstValueFrom(
        this.http.get<SessionInfo>('/api/auth/session?include=chrome', {
          withCredentials: true,
          headers: { 'X-Skip-Loading': 'true' },
        }),
      );
      this._session.set(session);
      // Post-login envelope carries the chrome config — push it into the
      // chrome service so the shell renders the right navbar / footer on
      // first paint. `null` when anonymous (login page renders, chrome is
      // unused).
      this.chromeService.hydrate(session.chrome);
      this.log.info('auth.session.loaded', {
        isAuthenticated: session.isAuthenticated,
      });
      // Antiforgery token must exist before the first mutation; provision it
      // here on the success path so the user can immediately interact with
      // POST / PUT / DELETE endpoints without race-conditioning on a separate
      // bootstrap step.
      if (session.isAuthenticated) {
        await this.ensureAntiforgeryToken();
      }
    } catch (err: unknown) {
      this.log.warn('auth.session.load.failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      this._session.set(null);
      // Keep the lastKnown chrome (if any) and surface the error so the
      // shell can render a status banner with a retry affordance.
      this.chromeService.markError(err);
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
   * @param prompt Optional Entra `prompt` value the BFF validates against an
   *   allowlist:
   *   - `'select_account'` — show the account picker even when an Entra SSO
   *     session exists. Recommended for the user-facing Sign-in button so an
   *     explicit click after sign-out doesn't silently re-auth on the same
   *     account (the SSO surprise users hit when there's no prompt).
   *   - `'login'` — force credential re-entry. Use for step-up before
   *     destructive operations.
   *   - omitted — passive SSO; transparent re-auth when an Entra session
   *     exists. Right for auth-guard / silent redirect paths where any
   *     UI prompt would be jarring.
   */
  login(returnUrl?: string, prompt?: 'select_account' | 'login'): void {
    const target = this.buildAuthUrl('/api/auth/login', returnUrl, prompt);
    this.log.info('auth.login.start', { returnUrl, prompt });
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
    this.chromeService.reset();
    this.sessionMonitor.stop();
    // Logout invalidates the BFF's HttpOnly antiforgery secret cookie; the
    // next session must re-fetch a fresh token pair.
    this.antiforgeryReady = false;

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

  /**
   * Issues the readable `XSRF-TOKEN` cookie via `GET /api/antiforgery/token`.
   * Idempotent — the second call is a cheap no-op once the cookie is set.
   *
   * Failures here are logged but never thrown: a missing cookie surfaces later
   * as a 400 on the first mutation, which is a better signal than crashing
   * app bootstrap. Cookies are not exposed to JS error events on cross-site
   * boundaries, so we can't distinguish "set" from "blocked"; we trust the
   * 200 response status.
   */
  private async ensureAntiforgeryToken(): Promise<void> {
    if (this.antiforgeryReady) return;
    try {
      await firstValueFrom(
        this.http.get<{ headerName: string }>('/api/antiforgery/token', {
          withCredentials: true,
          headers: { 'X-Skip-Loading': 'true' },
        }),
      );
      this.antiforgeryReady = true;
      this.log.info('auth.antiforgery.ready');
    } catch (err: unknown) {
      this.log.warn('auth.antiforgery.failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  /**
   * Builds a BFF auth URL with a validated `returnUrl` + optional `prompt`
   * query string. The BFF validates both server-side too — this client-side
   * pre-validation just avoids round-trips for obvious-nonsense inputs.
   */
  private buildAuthUrl(
    path: string,
    returnUrl?: string,
    prompt?: 'select_account' | 'login',
  ): string {
    const params: string[] = [];

    if (returnUrl) {
      // Open-redirect defense mirrors the BFF: only allow paths starting with
      // `/` (not `//` — protocol-relative), not containing backslashes.
      const safe =
        returnUrl.startsWith('/') &&
        !returnUrl.startsWith('//') &&
        !returnUrl.includes('\\')
          ? returnUrl
          : '/';
      params.push(`returnUrl=${encodeURIComponent(safe)}`);
    }

    if (prompt) {
      params.push(`prompt=${encodeURIComponent(prompt)}`);
    }

    return params.length === 0 ? path : `${path}?${params.join('&')}`;
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
        this.chromeService.reset();
        this.sessionMonitor.stop();
        this.antiforgeryReady = false;
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
