/**
 * ─── APPLICATION PROVIDER GRAPH ─────────────────────────────────────────────────
 *
 * WHY
 *   One canonical place that wires every cross-cutting concern the app needs:
 *   change detection, router, HTTP client + interceptor chain, animations,
 *   PrimeNG, MSAL, app initializers. Other files should import from here
 *   only — never re-compose providers elsewhere.
 *
 * CURRENT WIRING
 *   - Zoneless change detection
 *   - Router with component-input-binding + view-transitions + reload-on-same-url
 *   - HttpClient with functional interceptor chain (MsalInterceptor class + seven functional)
 *   - PrimeNG with Aura preset + MessageService/ConfirmationService
 *   - MSAL providers (factories read from RUNTIME_CONFIG → Phase 2.1)
 *   - Runtime-config loader (Phase 2.1) — MUST run before MSAL init
 *   - MSAL init (`provideAppInitializer`) — runs AFTER runtime config so
 *     the `PublicClientApplication` factory sees deployment-scoped IDs
 *   - LOCALE_ID
 *
 * PHASE 2+ EXTENSIONS (coming)
 *   - Phase 2.2: CSP violation reporter wired via provideAppInitializer
 *   - Phase 3.1: telemetry init (`provideAppInitializer(initTelemetry)`)
 *   - Phase 3.2: global `ErrorHandler`
 *
 * INITIALIZER ORDER (critical)
 *   `provideAppInitializer(...)` factories run sequentially in registration
 *   order. Current order:
 *     1. loadRuntimeConfig  — populates RUNTIME_CONFIG holder from /config.json
 *     2. MSAL init           — injects MsalService → resolves MSAL_INSTANCE →
 *                              msalInstanceFactory() reads RUNTIME_CONFIG (now populated)
 *
 *   Any future initializer that depends on MSAL (e.g. telemetry user context)
 *   registers AFTER the MSAL initializer; anything that reads runtime config
 *   but not MSAL can register anywhere after #1.
 *
 * MODERN APIs
 *   - `provideAppInitializer(() => { ... })` REPLACES the deprecated
 *     `{ provide: APP_INITIALIZER, useFactory, deps, multi: true }` pattern.
 *     Inject dependencies inside the factory via `inject()` — cleaner + no `deps` array.
 *
 *   - `provideBrowserGlobalErrorListeners()` REPLACES manual `window.onerror`
 *     + `unhandledrejection` listeners — auto-cleans-up, telemetry-ready.
 */
import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  LOCALE_ID,
  type ApplicationConfig,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';

import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalInterceptor,
  MsalService,
} from '@azure/msal-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { providePrimeNG } from 'primeng/config';

import { routes } from '../app.routes';
import {
  msalGuardConfig,
  msalInstanceFactory,
  msalInterceptorConfigFactory,
} from './msal.config';
import { primeNgConfig } from './primeng.config';
import { loadRuntimeConfig } from './runtime-config';
import { LoggerService } from '@core/services/logger.service';
import { CspViolationReporterService } from '@core/services/csp-violation-reporter.service';

import {
  correlationInterceptor,
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
    /*
     * Catches JS errors + unhandled promise rejections early. Once the
     * telemetry-backed `GlobalErrorHandlerService` lands in Phase 3, its
     * `ErrorHandler` provider takes over formal error handling; this
     * `provideBrowserGlobalErrorListeners` remains for the raw listener wiring.
     */
    provideBrowserGlobalErrorListeners(),

    // ── 2. Change detection (zoneless) ──────────────────────────────────
    /*
     * Signals drive reactivity; Zone.js is not bundled. Every component MUST
     * declare `changeDetection: ChangeDetectionStrategy.OnPush`.
     */
    provideZonelessChangeDetection(),

    // ── 3. Router ────────────────────────────────────────────────────────
    /*
     *  - `withComponentInputBinding()`: route params auto-bind to component `input()`s
     *    (no more manual `ActivatedRoute.paramMap` subscriptions for the common case).
     *  - `withViewTransitions()`: native View Transitions API — smooth page transitions
     *    where supported, no-op elsewhere.
     *  - `withRouterConfig({ onSameUrlNavigation: 'reload' })`: clicking the active
     *    nav link re-runs resolvers + guards (required UX for "refresh" buttons).
     *
     * Preloading strategy lands in Phase 7 (performance).
     */
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),

    // ── 4. HTTP client + interceptor chain ──────────────────────────────
    /*
     * Chain order (canonical — Architecture §4.3):
     *   1. MsalInterceptor (class; registered via HTTP_INTERCEPTORS below)
     *   2. correlationInterceptor (functional)
     *   3. tenantInterceptor
     *   4. securityInterceptor
     *   5. loadingInterceptor
     *   6. loggingInterceptor
     *   7. retryInterceptor
     *   8. errorInterceptor
     *
     * `withInterceptorsFromDi()` bridges MSAL's class-based interceptor into
     * the functional chain. Class interceptors run BEFORE functional ones.
     */
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([
        correlationInterceptor,
        tenantInterceptor,
        securityInterceptor,
        loadingInterceptor,
        loggingInterceptor,
        retryInterceptor,
        errorInterceptor,
      ]),
    ),

    /*
     * MSAL class interceptor — attaches Bearer tokens per `protectedResourceMap`.
     * `multi: true` registers alongside any other HTTP_INTERCEPTORS.
     */
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },

    // ── 5. Animations (async) ───────────────────────────────────────────
    /*
     * Async loading defers the animation engine — shaves off startup cost on
     * routes that don't immediately animate. Required by PrimeNG for
     * dropdowns, dialogs, toast, etc.
     */
    provideAnimationsAsync(),

    // ── 6. PrimeNG ───────────────────────────────────────────────────────
    providePrimeNG(primeNgConfig),

    /*
     * PrimeNG services that power `<p-toast>` (MessageService),
     * `<p-confirmdialog>` (ConfirmationService), and programmatic modals
     * (DialogService). Exposed at root so any feature can dispatch them.
     */
    MessageService,
    ConfirmationService,
    DialogService,

    // ── 7. MSAL ─────────────────────────────────────────────────────────
    /*
     * Three DI tokens configure MSAL — all three read from RUNTIME_CONFIG so
     * the deployment can change tenants without a rebuild (Phase 2.1):
     *   - MSAL_INSTANCE          — the PublicClientApplication (factory)
     *   - MSAL_GUARD_CONFIG      — guard-layer defaults (static)
     *   - MSAL_INTERCEPTOR_CONFIG — protected-resource map (factory)
     *
     * Plus three services (`MsalService`, `MsalGuard`, `MsalBroadcastService`)
     * that our `AuthService` wraps. Components never inject these directly.
     */
    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useValue: msalGuardConfig },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: msalInterceptorConfigFactory },
    MsalService,
    MsalGuard,
    MsalBroadcastService,

    // ── 8. APP INITIALIZER — runtime config (Phase 2.1) ─────────────────
    /*
     * Fetches `/config.json` BEFORE Angular bootstraps. Populates the
     * `RUNTIME_CONFIG` holder that MSAL_INSTANCE / MSAL_INTERCEPTOR_CONFIG
     * / API_BASE_URL read from.
     *
     * This MUST run before the MSAL initializer below; otherwise the MSAL
     * factories see the build-time fallbacks which point at empty client IDs
     * in prod and the login redirect immediately fails with "invalid client".
     *
     * Outcome is logged (logger has no DI dependencies, safe to use here).
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

    // ── 9. APP INITIALIZER — MSAL init + redirect handling ──────────────
    /*
     * Runs BEFORE Angular bootstraps. This guarantees:
     *   1. PublicClientApplication.initialize() has completed (crypto / PKCE
     *      ready) before any component renders.
     *   2. Any pending OAuth redirect callback is fully processed via
     *      `handleRedirectPromise()`. The returned Promise resolves when the
     *      token exchange is done and the active account is set.
     *
     * WITHOUT THIS: routes resolve first, auth guard sees `isAuthenticated =
     * false`, fires `loginRedirect()` — MSAL throws `interaction_in_progress`
     * → infinite redirect loop.
     *
     * `provideAppInitializer` is the modern replacement for `APP_INITIALIZER`
     * — `inject()` inside the factory eliminates the `deps` array.
     */
    provideAppInitializer(async () => {
      const msal = inject(MsalService);
      await msal.instance.initialize();
      const result = await msal.instance.handleRedirectPromise();
      if (result?.account) {
        msal.instance.setActiveAccount(result.account);
      }
    }),

    // ── 10. APP INITIALIZER — CSP violation reporter (Phase 2.2) ────────
    /*
     * Registers a `securitypolicyviolation` DOM-event listener so any CSP
     * block hits our structured log (and Phase-3 telemetry). Purely
     * observational — does not modify the policy itself.
     *
     * Order-agnostic relative to MSAL init; placed after it so MSAL-related
     * violations surface with the correlation id populated by the first
     * outbound request.
     */
    provideAppInitializer(() => {
      inject(CspViolationReporterService).register();
    }),

    // ── 11. Locale ───────────────────────────────────────────────────────
    /*
     * Default locale drives DatePipe / CurrencyPipe / DecimalPipe formatting.
     * Becomes signal-driven via `LocaleStore` in Phase 8.
     */
    { provide: LOCALE_ID, useValue: 'en-US' },
  ],
};
