/**
 * ─── AUTH SERVICE (MSAL + Signal-Based) ─────────────────────────────────────────
 *
 * WHY
 *   A thin, signal-based facade over `@azure/msal-angular` so:
 *
 *     1. Components never inject `MsalService` directly — they see a stable
 *        `AuthService` contract that hides the raw library surface.
 *     2. Login / logout / active-account state is exposed as signals, so
 *        zoneless change detection Just Works and templates bind naturally.
 *     3. Permission hydration is triggered automatically on sign-in (see
 *        `AuthStore.hydrate()`), so guards never race the effective-permissions
 *        fetch.
 *     4. The BFF-cookie alternative (U1 hybrid path, Phase 9) can later implement
 *        the same public contract — components won't notice the swap.
 *
 * WHAT MSAL HANDLES FOR US (reading these saves re-implementing them):
 *   - PKCE code_verifier + code_challenge exchange.
 *   - Token cache in `localStorage` (per `BrowserCacheLocation.LocalStorage`).
 *   - Silent refresh via `acquireTokenSilent` (with interactive fallback).
 *   - Concurrent-401 deduplication — one refresh, all requests wait.
 *   - Bearer-token attachment via `MsalInterceptor` + `protectedResourceMap`.
 *
 * WHAT WE ADD ON TOP:
 *   - Signals for reactive auth state.
 *   - Cross-tab logout broadcast via `BroadcastChannel('msal:auth')`.
 *   - Permission hydration triggered via `effect(() => ...)` on login.
 *   - `takeUntilDestroyed(DestroyRef)` for RxJS lifetime — no manual destroy$
 *     subject, no `ngOnDestroy` dance.
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus, type AccountInfo } from '@azure/msal-browser';
import { RUNTIME_CONFIG } from '@config/runtime-config';
import { AuthStore } from '@core/auth/auth.store';
import { SessionMonitorService } from '@core/auth/session-monitor.service';
import type { CurrentUser } from '@core/models';
import { LoggerService } from '@core/services/logger.service';

/** BroadcastChannel name used to sync logout events across open tabs. */
const LOGOUT_CHANNEL = 'msal:auth';
const LOGOUT_MESSAGE = 'logout';

/**
 * OIDC scopes requested on login. The custom API scope from
 * `RUNTIME_CONFIG.msal.apiScope` is appended dynamically — including it in
 * the initial login request means the user consents once and every
 * subsequent `acquireTokenSilent({ scopes: [apiScope] })` finds a cached
 * token, so `MsalInterceptor` can attach the bearer on Api calls without
 * triggering an interactive redirect mid-XHR.
 */
const BASE_LOGIN_SCOPES = ['openid', 'profile', 'User.Read'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly broadcast = inject(MsalBroadcastService);
  private readonly log = inject(LoggerService);
  private readonly authStore = inject(AuthStore);
  private readonly sessionMonitor = inject(SessionMonitorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(RUNTIME_CONFIG);

  // ── PUBLIC SIGNALS (reactive auth state) ─────────────────────────────────

  /**
   * Raw MSAL account (or `null` if anonymous). Most components should bind to
   * the derived `currentUser` signal below instead of this.
   *
   * Kept readable for advanced use (token introspection, claim-specific logic).
   */
  private readonly _account = signal<AccountInfo | null>(null);

  /** Is MSAL still initialising or handling a redirect? */
  readonly isLoading = signal<boolean>(true);

  /** Convenient projection of the raw account into app-facing `CurrentUser`. */
  readonly currentUser = computed<CurrentUser | null>(() => {
    const acc = this._account();
    if (!acc) return null;
    const claims = (acc.idTokenClaims ?? {}) as Record<string, unknown>;
    return {
      id: (claims['oid'] as string | undefined) ?? acc.localAccountId,
      displayName: acc.name ?? '',
      email: acc.username,
      aadTenantId: acc.tenantId ?? (claims['tid'] as string | undefined) ?? '',
    };
  });

  /** Whether the user is currently authenticated. */
  readonly isAuthenticated = computed(() => this._account() !== null);

  /** Convenience signals for chrome bindings. */
  readonly displayName = computed(() => this.currentUser()?.displayName ?? '');
  readonly email = computed(() => this.currentUser()?.email ?? '');

  /**
   * Roles from the id-token claim — coarse labels. Components doing UX gating
   * should prefer `permissions()` from `AuthStore` (authoritative, hydrated
   * from the backend).
   */
  readonly roles = computed<readonly string[]>(() => {
    const claims = (this._account()?.idTokenClaims ?? {}) as Record<string, unknown>;
    const raw = claims['roles'];
    return Array.isArray(raw) ? (raw as readonly string[]) : [];
  });

  constructor() {
    // MSAL `initialize()` + `handleRedirectPromise()` are already invoked by
    // `provideAppInitializer(...)` in `app.config.ts` BEFORE this constructor
    // runs. By the time we get here, the MSAL cache is valid and any redirect
    // callback has been processed.
    //
    // What this constructor does:
    //   1. Sync the current active account into our `_account` signal.
    //   2. Subscribe to `inProgress$` so subsequent interactions
    //      (silent refresh, interactive login) update our state.
    //   3. Flip `isLoading` to false once the first `InteractionStatus.None`
    //      arrives (MSAL uses `Startup` until then).
    //   4. Set up cross-tab logout sync.
    //   5. Trigger permission hydration whenever we transition into an
    //      authenticated state (`effect` runs on signal change).
    this.syncAccountFromMsal();
    this.subscribeToMsalInteractions();
    this.subscribeToCrossTabLogout();
    this.triggerHydrationOnLogin();

    // `provideAppInitializer(...)` in app.config.ts already awaits
    // `msal.initialize()` + `handleRedirectPromise()` before Angular
    // finishes bootstrap — by the time this constructor runs, MSAL IS idle.
    // MSAL-Angular v5's `inProgress$` doesn't reliably replay the pre-
    // subscription `None` transition, so the filter-based subscription below
    // may never fire on first load. Flip the loading flag eagerly here; the
    // subscription keeps it accurate across future interactions (silent
    // refresh, logout, interactive reauth).
    this.isLoading.set(false);
  }

  // ── AUTH OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Starts the Azure AD redirect login flow.
   *
   * The caller typically supplies `redirectUrl` from `ActivatedRoute` so the
   * user lands where they were going before the auth guard intercepted.
   *
   * @param redirectUrl Optional full URL to navigate to once login completes.
   */
  login(redirectUrl?: string): void {
    // Compose scopes: OIDC baseline + the runtime-configured custom API
    // scope. Requesting the custom scope here means Entra shows a consent
    // screen once (first login) and every subsequent silent token acquisition
    // for the Api succeeds from cache — MsalInterceptor can attach the
    // bearer without an interactive redirect mid-XHR.
    const apiScope = this.runtime.msal.apiScope;
    const scopes = apiScope
      ? [...BASE_LOGIN_SCOPES, apiScope]
      : [...BASE_LOGIN_SCOPES];
    this.log.info('auth.login.start', { redirectUrl, scopes });
    this.msal.loginRedirect({
      scopes,
      redirectStartPage: redirectUrl,
    });
  }

  /**
   * Logs the user out locally, broadcasts to other tabs, and triggers the
   * Azure AD sign-out redirect.
   *
   * Why clear local state BEFORE the redirect: between the
   * `msal.logoutRedirect()` call and the actual navigation, a small window
   * exists where the UI might render with stale signals. Clearing first
   * avoids that flicker.
   *
   * Why `/auth/login` as post-logout URL (not `/`): `/` resolves to a
   * protected route, the auth guard triggers `loginRedirect()`, which MSAL
   * rejects because the logout interaction is still in progress — an
   * "interaction_in_progress" error loop. Pointing straight at `/auth/login`
   * sidesteps it.
   */
  logout(): void {
    this.log.info('auth.logout.start');

    // 1. Clear local signals first.
    this._account.set(null);
    this.authStore.reset();
    this.sessionMonitor.stop();

    // 2. Broadcast to other tabs so they also clear.
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(LOGOUT_CHANNEL).postMessage(LOGOUT_MESSAGE);
      }
    } catch {
      // BroadcastChannel can fail in older browsers / security contexts —
      // not fatal; the redirect still clears this tab.
    }

    // 3. Redirect to Azure AD sign-out.
    this.msal.logoutRedirect({
      postLogoutRedirectUri: '/auth/login',
    });
  }

  /**
   * Acquires an access token for specific scopes. Used by code paths that
   * can't go through the `MsalInterceptor` (WebSocket handshake, manual
   * `fetch`, etc.).
   *
   * On silent failure, MSAL falls back to an interactive redirect — the
   * current page unmounts. Callers should assume the Promise never resolves
   * after a failure in that case.
   */
  async getAccessToken(scopes: readonly string[]): Promise<string | null> {
    const account = this.msal.instance.getActiveAccount();
    if (!account) return null;

    try {
      const result = await this.msal.instance.acquireTokenSilent({
        scopes: [...scopes],
        account,
      });
      return result.accessToken;
    } catch (err) {
      this.log.warn('auth.token.silent.failed', { err });
      this.msal.acquireTokenRedirect({ scopes: [...scopes] });
      return null;
    }
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  /**
   * Reads MSAL's cache and writes the active account into our signal.
   *
   * MSAL supports multiple cached accounts; we prefer the one explicitly
   * marked "active" (set via `setActiveAccount`), falling back to the first
   * cached account. If there are none, we clear our signal.
   */
  private syncAccountFromMsal(): void {
    // Defensive: MSAL-Browser v5 throws `uninitialized_public_client_application`
    // from `getAllAccounts()` when called before `initialize()` has resolved —
    // easy to trip on hard-refresh because Angular's `provideAppInitializer`
    // hooks run in parallel (Promise.all) and `TelemetryUserSyncService`
    // constructs `AuthService` (triggering this sync) during the telemetry
    // initializer, which may race the MSAL-init initializer.
    //
    // On the race losing branch we simply skip this sync. The follow-up
    // `inProgress$.subscribe(... InteractionStatus.None …)` below re-invokes
    // `syncAccountFromMsal()` once MSAL transitions to idle, so no account
    // data is permanently missed.
    let active: AccountInfo | null;
    try {
      const accounts = this.msal.instance.getAllAccounts();
      active = this.msal.instance.getActiveAccount() ?? accounts[0] ?? null;
    } catch (err) {
      this.log.warn('auth.sync.deferred', {
        reason: 'MSAL not yet initialized; will retry on first idle event',
        err: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (active) {
      this.msal.instance.setActiveAccount(active);
    }
    this._account.set(active);
  }

  /**
   * Subscribes to MSAL `inProgress$`, which emits an `InteractionStatus` as
   * the user navigates login/logout/refresh flows. We re-sync whenever the
   * status returns to `None` (i.e. MSAL is idle again).
   *
   * `takeUntilDestroyed(destroyRef)` handles cleanup — no manual destroy$
   * subject, no `ngOnDestroy`.
   */
  private subscribeToMsalInteractions(): void {
    this.broadcast.inProgress$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === InteractionStatus.None) {
          this.syncAccountFromMsal();
          this.isLoading.set(false);
        } else {
          // Interaction in flight (silent refresh, interactive login, etc).
          // Gate the UI briefly so components that read `isLoading` reflect
          // MSAL's real state, not just the initial-bootstrap snapshot.
          this.isLoading.set(true);
        }
      });
  }

  /**
   * Listens for `logout` messages on the shared channel. When another tab
   * logs out, we clear our local state too so the user isn't left with a
   * zombie authenticated UI in this tab.
   */
  private subscribeToCrossTabLogout(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.onmessage = (evt) => {
      if (evt.data === LOGOUT_MESSAGE) {
        this._account.set(null);
        this.authStore.reset();
      }
    };
    // Close the channel when this service is destroyed.
    this.destroyRef.onDestroy(() => channel.close());
  }

  /**
   * Reactive hydration: every time `isAuthenticated()` becomes `true`, fire
   * `AuthStore.hydrate()` to fetch effective permissions.
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
            // Phase 2.4 — start the session monitor once we're logged in.
            // Idempotent; safe to call on every transition.
            this.sessionMonitor.start();
          });
        }
      },
      { manualCleanup: false },
    );
  }
}
