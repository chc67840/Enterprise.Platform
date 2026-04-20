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
 * CREDENTIAL SOURCING (Phase 2.1)
 *   All three read from `RUNTIME_CONFIG` so the deployment can change tenants
 *   / API URLs without a rebuild. These factories are invoked as DI
 *   `useFactory`s which run inside an injection context, so `inject()` calls
 *   resolve correctly — but they run LAZY on first consumer resolution, which
 *   happens INSIDE the MSAL `provideAppInitializer`. Registration order in
 *   `app.config.ts` therefore matters: the runtime-config initializer must
 *   run BEFORE the MSAL initializer, which is how we wire it.
 *
 * AUTHORITY TYPES
 *   The default authority `https://login.microsoftonline.com/{tenantId}` is
 *   for Entra B2B (organizational accounts). For B2C, use the policy-specific
 *   URL (`https://<b2cTenant>.b2clogin.com/<b2cTenant>.onmicrosoft.com/<policy>/`).
 *   Multi-mode support (both B2B + B2C) would add a second instance + a guard-
 *   level policy scheme selector; out of scope for Phase 2.
 */
import { inject } from '@angular/core';
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

import { RUNTIME_CONFIG } from './runtime-config';

/**
 * PublicClientApplication factory. Reads MSAL identifiers from
 * `RUNTIME_CONFIG`, falling back to `environment.msal.redirectUri` when the
 * runtime config does not override it (common in dev where `window.origin`
 * is the implicit default).
 *
 * Registered via `useFactory` in `app.config.ts` so `inject()` works inside.
 */
export function msalInstanceFactory(): PublicClientApplication {
  const rc = inject(RUNTIME_CONFIG);
  const redirectUri = rc.msal.redirectUri || environment.msal.redirectUri;
  const postLogoutRedirectUri = rc.msal.postLogoutRedirectUri || '/auth/login';

  const config: Configuration = {
    auth: {
      /** Azure AD application (client) id. Public identifier. */
      clientId: rc.msal.clientId,
      /** Tenant id scopes the authority. Use `'common'` to accept any tenant. */
      authority: rc.msal.tenantId
        ? `https://login.microsoftonline.com/${rc.msal.tenantId}`
        : 'https://login.microsoftonline.com/common',
      /** Redirect URI registered in the App Registration. Must be an exact match. */
      redirectUri,
      /** Where to land after sign-out. `/auth/login` is a public route (no guard). */
      postLogoutRedirectUri,
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
 * MsalGuard configuration. Static shape — interaction type and scopes never
 * vary per deployment, so this stays a plain constant.
 */
export const msalGuardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect,
  authRequest: {
    scopes: ['openid', 'profile', 'User.Read'],
  },
  loginFailedRoute: '/auth/login',
};

/**
 * Interceptor-configuration factory. Reads the API base URL + scope from
 * runtime config so the deployed `MsalInterceptor` attaches bearer tokens to
 * the correct endpoint per environment.
 *
 *   - MS Graph endpoints need `User.Read` for the signed-in user's profile.
 *   - The platform API scope is pulled from `rc.msal.apiScope`.
 *
 * Using a factory (not a constant) is required for the runtime-config lookup.
 * Registered via `useFactory` in `app.config.ts`.
 */
export function msalInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const rc = inject(RUNTIME_CONFIG);
  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap: new Map<string, string[]>([
      ['https://graph.microsoft.com/v1.0/', ['User.Read']],
      [rc.apiBaseUrl, rc.msal.apiScope ? [rc.msal.apiScope] : []],
    ]),
  };
}
