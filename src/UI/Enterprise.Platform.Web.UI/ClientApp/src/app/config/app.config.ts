/**
 * ─── APPLICATION PROVIDER GRAPH ─────────────────────────────────────────────────
 *
 * WHY
 *   One canonical place that wires every cross-cutting concern the app needs:
 *   change detection, router, HTTP client + interceptor chain, animations,
 *   PrimeNG, app initializers, telemetry, error handling. Other files should
 *   import from here only — never re-compose providers elsewhere.
 *
 * POST-PHASE-9 WIRING
 *   Auth is now cookie-session backed. MSAL is gone. The SPA never sees a
 *   token — the BFF owns the OIDC flow, cookie issuance, and bearer-token
 *   attachment on downstream calls.
 *
 * INITIALIZER ORDER (critical — runs sequentially in registration order)
 *     1. loadRuntimeConfig — populates RUNTIME_CONFIG from `/config.json`
 *     2. AuthService.refreshSession — fetches `/api/auth/session` so the
 *        first render already knows whether we're signed in
 *     3. TelemetryService.init — reads runtime config + (later) session user
 *     4. CspViolationReporter — subscribes to `securitypolicyviolation` DOM event
 *
 * HTTP INTERCEPTOR CHAIN (functional — Architecture §4.3, updated for Phase 9)
 *     1. correlationInterceptor — mints / echoes `X-Correlation-ID`
 *     2. tenantInterceptor       — attaches `X-Tenant-ID`
 *     3. securityInterceptor     — reads `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header
 *     4. cacheInterceptor        — GET cache (Phase 6)
 *     5. dedupInterceptor        — in-flight GET dedup (Phase 6)
 *     6. loadingInterceptor      — global loading indicator
 *     7. loggingInterceptor      — structured request/response logs
 *     8. retryInterceptor        — idempotent-safe retry on transient failures
 *     9. errorInterceptor        — 401/403 redirect handling, error normalization
 *
 *   MSAL's class interceptor is removed; the BFF attaches bearer tokens
 *   server-side. The browser carries only the HttpOnly session cookie
 *   (automatic via `withCredentials: true` on the session-aware calls) +
 *   the XSRF double-submit pair.
 */
import {
  ErrorHandler,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  LOCALE_ID,
  type ApplicationConfig,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';

import { CustomPreloader } from '@core/routing/custom-preloader';

import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { providePrimeNG } from 'primeng/config';

import { routes } from '../app.routes';
import { primeNgConfig } from './primeng.config';
import { loadRuntimeConfig } from './runtime-config';
import { AuthService } from '@core/auth/auth.service';
import { LoggerService } from '@core/services/logger.service';
import { CspViolationReporterService } from '@core/services/csp-violation-reporter.service';
import {
  GlobalErrorHandlerService,
  TelemetryService,
} from '@core/observability';

import {
  cacheInterceptor,
  correlationInterceptor,
  dedupInterceptor,
  errorInterceptor,
  loadingInterceptor,
  loggingInterceptor,
  retryInterceptor,
  securityInterceptor,
  tenantInterceptor,
} from '@core/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    // ── 1. Unhandled-error listeners ─────────────────────────────────────
    provideBrowserGlobalErrorListeners(),

    // ── 2. Change detection (zoneless) ──────────────────────────────────
    provideZonelessChangeDetection(),

    // ── 3. Router ────────────────────────────────────────────────────────
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
      withPreloading(CustomPreloader),
    ),

    // ── 4. HTTP client + interceptor chain ──────────────────────────────
    /*
     * `withXsrfConfiguration` wires Angular's built-in XSRF interceptor:
     *   - Reads the `XSRF-TOKEN` cookie (set by the BFF's
     *     `AntiForgeryController.GetToken` on session bootstrap).
     *   - Echoes it as `X-XSRF-TOKEN` on every non-safe (POST/PUT/PATCH/DELETE)
     *     request to the same origin.
     *   - Skips safe verbs and cross-origin requests automatically.
     *
     * Our `securityInterceptor` ALSO sets `X-XSRF-TOKEN` for same-origin `/api/*`
     * calls — the two are complementary: the built-in covers all mutating
     * verbs project-wide, the security one ensures the header is present
     * even for safe-verb calls that the backend anti-forgery requires.
     */
    provideHttpClient(
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      }),
      withInterceptors([
        correlationInterceptor,
        tenantInterceptor,
        securityInterceptor,
        cacheInterceptor,
        dedupInterceptor,
        loadingInterceptor,
        loggingInterceptor,
        retryInterceptor,
        errorInterceptor,
      ]),
    ),

    // ── 5. Animations (async) ───────────────────────────────────────────
    provideAnimationsAsync(),

    // ── 6. PrimeNG ───────────────────────────────────────────────────────
    providePrimeNG(primeNgConfig),
    MessageService,
    ConfirmationService,
    DialogService,

    // ── 7. APP INITIALIZER — runtime config (Phase 2.1) ─────────────────
    /*
     * Fetches `/config.json` before bootstrap. Populates the RUNTIME_CONFIG
     * holder so API_BASE_URL, telemetry sink, and session-window values are
     * ready before any service constructs.
     */
    provideAppInitializer(async () => {
      const logger = inject(LoggerService);
      const outcome = await loadRuntimeConfig({
        onOutcome: (o) => {
          if (o === 'fetched') {
            logger.info('runtime-config.loaded');
          } else {
            logger.warn('runtime-config.fallback', {
              reason: 'network-or-404 — using environment.ts defaults',
            });
          }
        },
      });
      return outcome;
    }),

    // ── 8. APP INITIALIZER — session probe (Phase 9.D) ──────────────────
    /*
     * Calls `GET /api/auth/session` once before bootstrap so the first render
     * already knows whether the user is signed in. Replaces MSAL's
     * `handleRedirectPromise()` + `inProgress$` initialization.
     *
     * Network-tolerant — see `AuthService.refreshSession` comment. A failure
     * here doesn't block boot; subsequent interceptor 401s trigger the
     * login redirect.
     */
    provideAppInitializer(() => inject(AuthService).refreshSession()),

    // ── 9. APP INITIALIZER — Telemetry (Phase 3.1) ──────────────────────
    provideAppInitializer(() => inject(TelemetryService).init()),

    /*
     * Replace Angular's default `ErrorHandler` with our telemetry-aware
     * handler. Registered near the top of the provider list so descendant
     * components inherit it without a local override.
     */
    { provide: ErrorHandler, useClass: GlobalErrorHandlerService },

    // ── 10. APP INITIALIZER — CSP violation reporter (Phase 2.2) ────────
    provideAppInitializer(() => {
      inject(CspViolationReporterService).register();
    }),

    // ── 11. Locale ───────────────────────────────────────────────────────
    { provide: LOCALE_ID, useValue: 'en-US' },
  ],
};
