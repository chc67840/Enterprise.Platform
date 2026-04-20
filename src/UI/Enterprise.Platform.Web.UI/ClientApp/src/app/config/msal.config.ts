/**
 * ─── MSAL CONFIGURATION ─────────────────────────────────────────────────────────
 *
 * WHY
 *   Three bits of configuration are needed for `@azure/msal-angular`:
 *
 *     1. `MSAL_INSTANCE` — the `PublicClientApplication` itself. This is the
 *        OAuth engine: PKCE, token cache, silent refresh, redirect handling.
 *
 *     2. `MSAL_GUARD_CONFIG` — how the (unused-for-now) `MsalGuard` behaves.
 *        We don't use `MsalGuard` directly (our `authGuard` covers it), but
 *        MSAL requires the token to be provided.
 *
 *     3. `MSAL_INTERCEPTOR_CONFIG` — the protected-resource map: for each
 *        URL prefix, the scopes required. `MsalInterceptor` reads this,
 *        acquires tokens silently, and attaches Bearer headers automatically.
 *
 * CREDENTIAL SOURCING
 *   Phase 1 reads IDs from `environment.msal` (build-time). Phase 2.1 swaps
 *   this to read from `RUNTIME_CONFIG` so the deployment can change tenants
 *   without a rebuild. Either way, **no secrets here** — MSAL `clientId` is
 *   a public identifier.
 *
 * AUTHORITY TYPES
 *   The default authority `https://login.microsoftonline.com/{tenantId}` is
 *   for Entra B2B (organizational accounts). For B2C, use the policy-specific
 *   URL (`https://<b2cTenant>.b2clogin.com/<b2cTenant>.onmicrosoft.com/<policy>/`).
 *   Multi-mode support (both B2B + B2C) would add a second instance + a guard-
 *   level policy scheme selector; out of scope for Phase 1.
 */
import {
  InteractionType,
  type Configuration,
  LogLevel,
  PublicClientApplication,
} from '@azure/msal-browser';
import type {
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
} from '@azure/msal-angular';

import { environment } from '@env/environment';

/**
 * PublicClientApplication factory.
 *
 * Returns a single instance the whole app shares (MSAL holds its own
 * singleton cache internally, but supplying the same reference is cleaner).
 * Called by the DI token `MSAL_INSTANCE`.
 */
export function msalInstanceFactory(): PublicClientApplication {
  const config: Configuration = {
    auth: {
      /** Azure AD application (client) id. Public identifier. */
      clientId: environment.msal.clientId,
      /** Tenant id scopes the authority. Use `'common'` to accept any tenant. */
      authority: environment.msal.tenantId
        ? `https://login.microsoftonline.com/${environment.msal.tenantId}`
        : 'https://login.microsoftonline.com/common',
      /** Redirect URI registered in the App Registration. Must be an exact match. */
      redirectUri: environment.msal.redirectUri,
      /**
       * Where to land after sign-out. `/auth/login` keeps the UX simple —
       * the auth guard won't retrigger since this is a public route.
       */
      postLogoutRedirectUri: '/auth/login',
    },
    cache: {
      /**
       * `localStorage` survives tab close → users don't re-enter MFA on every
       * new browser window. Trade-off: tokens are accessible to same-origin
       * JS; mitigated by CSP (Phase 2.2) and short access-token lifetime.
       *
       * Cross-tab auth-state sync is handled at the app layer via
       * `BroadcastChannel` in `AuthService` — we don't need MSAL's
       * `storeAuthStateInCookie` flag for that.
       */
      cacheLocation: 'localStorage',
    },
    system: {
      loggerOptions: {
        // MSAL's library-internal logger. Ours (`LoggerService`) wraps app-
        // level events; this one covers the token-exchange internals.
        loggerCallback: (level, message) => {
          if (level === LogLevel.Error) {
            // eslint-disable-next-line no-console -- library-level last resort
            console.error('[MSAL]', message);
          } else if (!environment.production && level <= LogLevel.Info) {
            // eslint-disable-next-line no-console -- dev-only
            console.log('[MSAL]', message);
          }
        },
        piiLoggingEnabled: false,
        logLevel: environment.production ? LogLevel.Warning : LogLevel.Info,
      },
    },
  };

  return new PublicClientApplication(config);
}

/**
 * MsalGuard configuration. Even though we don't use `MsalGuard` directly,
 * the token must be provided or MSAL's module throws.
 */
export const msalGuardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect,
  authRequest: {
    scopes: ['openid', 'profile', 'User.Read'],
  },
  loginFailedRoute: '/auth/login',
};

/**
 * Interceptor configuration — which URLs get Bearer tokens, and with what
 * scopes.
 *
 *   - MS Graph endpoints need `User.Read` for the signed-in user's profile.
 *   - The platform API uses the scope from `environment.msal.apiScope`.
 *
 * `null` in the scopes array tells MSAL not to attach a token for that URL.
 * We don't use that today — if a call should skip MSAL, it uses a different
 * base URL (external CDN etc.) that isn't in this map.
 */
export const msalInterceptorConfig: MsalInterceptorConfiguration = {
  interactionType: InteractionType.Redirect,
  protectedResourceMap: new Map<string, string[]>([
    ['https://graph.microsoft.com/v1.0/', ['User.Read']],
    [environment.apiBaseUrl, environment.msal.apiScope ? [environment.msal.apiScope] : []],
  ]),
};
