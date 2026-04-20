/**
 * ─── APPLICATION PROVIDER GRAPH ─────────────────────────────────────────────────
 *
 * WHY
 *   One canonical place that wires every cross-cutting concern the app needs:
 *   change detection, router, HTTP client + interceptor chain, animations,
 *   PrimeNG, MSAL, app initializers. Other files should import from here
 *   only — never re-compose providers elsewhere.
 *
 * PHASE 1 WIRING (this file)
 *   - Zoneless change detection
 *   - Router with component-input-binding + view-transitions + reload-on-same-url
 *   - HttpClient with functional interceptor chain (MsalInterceptor class + six functional)
 *   - PrimeNG with Aura preset + MessageService/ConfirmationService
 *   - MSAL providers + `provideAppInitializer` for `initialize()` + `handleRedirectPromise()`
 *   - LOCALE_ID
 *
 * PHASE 2+ EXTENSIONS (coming)
 *   - Phase 2.1: runtime config loader (`provideAppInitializer(loadRuntimeConfig)`)
 *   - Phase 3.1: telemetry init (`provideAppInitializer(initTelemetry)`)
 *   - Phase 3.2: global `ErrorHandler`
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
  msalInterceptorConfig,
} from './msal.config';
import { primeNgConfig } from './primeng.config';

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
     * Three DI tokens configure MSAL:
     *   - MSAL_INSTANCE       — the PublicClientApplication
     *   - MSAL_GUARD_CONFIG   — guard-layer defaults
     *   - MSAL_INTERCEPTOR_CONFIG — protected-resource map for auto-token-attach
     *
     * Plus three services (`MsalService`, `MsalGuard`, `MsalBroadcastService`)
     * that our `AuthService` wraps. Components never inject these directly.
     */
    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useValue: msalGuardConfig },
    { provide: MSAL_INTERCEPTOR_CONFIG, useValue: msalInterceptorConfig },
    MsalService,
    MsalGuard,
    MsalBroadcastService,

    // ── 8. APP INITIALIZER — MSAL init + redirect handling ──────────────
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

    // ── 9. Locale ────────────────────────────────────────────────────────
    /*
     * Default locale drives DatePipe / CurrencyPipe / DecimalPipe formatting.
     * Becomes signal-driven via `LocaleStore` in Phase 8.
     */
    { provide: LOCALE_ID, useValue: 'en-US' },
  ],
};
