/**
 * ─── TELEMETRY SERVICE (Application Insights + web-vitals) ──────────────────────
 *
 * WHY
 *   A thin facade over `@microsoft/applicationinsights-web` plus web-vitals
 *   so feature code never imports the SDK directly. Benefits:
 *
 *     1. Swappable sink — flipping to OpenTelemetry-web or Sentry later is a
 *        single-file change; every call site already goes through this facade.
 *     2. Centralised PII scrubbing — every event payload is scrubbed via
 *        `LoggerService.scrub()` so the same redaction rules apply to dev
 *        console logs and to telemetry in one code path.
 *     3. Init is idempotent + test-safe — tests default to `connectionString`
 *        empty, which makes `init()` a no-op; no network required under
 *        Vitest.
 *
 * PHASE 7.2 — LAZY SDK LOAD
 *   The Application Insights SDK is ~350 kB raw / ~100 kB gzipped — too big
 *   to eagerly ship in the initial bundle. It is now loaded via
 *   `await import('@microsoft/applicationinsights-web')` inside `init()`,
 *   AND only when `runtime.telemetry.appInsightsConnectionString` is set.
 *   Sessions without a connection string (dev, unit tests, offline) never
 *   download the SDK. The dynamic-import chunk name is stamped by the
 *   bundler so stats.json shows it as a named lazy chunk.
 *
 * SAMPLING
 *   - Global events/pageviews/errors gated by `telemetry.sampleRate` (default 1).
 *   - Web-vitals gated by `telemetry.webVitalsSampleRate` (default 0.1).
 *   Two independent knobs because error/trace signal is rare+valuable while
 *   web-vitals is high-volume and averages-well even at 10%.
 *
 * CORRELATION + USER CONTEXT
 *   `trackError` / `trackEvent` attach:
 *     - `correlationId` — from `CorrelationContextService.active()`.
 *     - `userId` — from `TelemetryUserSyncService` (broken out to avoid a
 *       DI cycle with AuthService).
 *     - `route` — `Router.url` at the time of the call.
 *
 * FAILURE POLICY
 *   - Missing connection string → log warn and no-op (dev / offline mode).
 *   - SDK load-time failures → log error, never throw. Telemetry is best-effort;
 *     the app must continue regardless.
 */
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '@env/environment';
import { RUNTIME_CONFIG } from '@config/runtime-config';
import { CorrelationContextService } from '@core/services/correlation-context.service';
import { LoggerService } from '@core/services/logger.service';

import {
  WEB_VITALS_BUDGETS,
  isWithinBudget,
  type WebVitalName,
} from './web-vitals-budgets';

// Imported as TYPES only — the value side is a dynamic import inside init().
// The Angular/esbuild bundler treats `import type` as erasable so the SDK's
// runtime code stays out of the initial chunk.
import type {
  ApplicationInsights,
  IEventTelemetry,
  IExceptionTelemetry,
  IMetricTelemetry,
  IPageViewTelemetry,
} from '@microsoft/applicationinsights-web';

/** Release-tag shape stamped onto every telemetry record. */
interface ReleaseTag {
  readonly release: string;
  readonly environment: 'development' | 'staging' | 'production';
}

/**
 * Properties merged into every custom event / exception. `correlationId`
 * comes from the ambient `CorrelationContextService` so logs emitted during
 * an HTTP request line up with the backend's structured record for the same
 * request.
 */
interface CommonEnvelope {
  readonly [key: string]: string | number | boolean | undefined;
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly runtime = inject(RUNTIME_CONFIG);
  private readonly correlation = inject(CorrelationContextService);
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);

  private appInsights: ApplicationInsights | null = null;
  private initialized = false;

  /**
   * Latest-known user id stamped onto envelopes. Written by
   * `setUserContext` (called from `TelemetryUserSyncService`) — pulling the
   * live `AuthService` state into TelemetryService directly would create a
   * DI cycle (AuthService → TelemetryService → AuthService).
   */
  private currentUserId: string | null = null;
  private readonly tag: ReleaseTag = {
    release: environment.buildStamp,
    environment: environment.production
      ? 'production'
      : environment.staging
        ? 'staging'
        : 'development',
  };

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Initializes Application Insights using the runtime-config connection
   * string. Called from `provideAppInitializer`. Idempotent — a second call
   * is a no-op so tests that spin up the app repeatedly don't stack SDKs.
   *
   * The SDK's JS bundle is loaded on-demand via `await import(...)`. Sessions
   * without a connection string skip the fetch entirely — saves ~100 kB gz
   * on dev / offline / unit-test paths.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const connectionString = this.runtime.telemetry.appInsightsConnectionString.trim();
    if (!connectionString) {
      // Dev / offline — telemetry is opt-in. The service still operates; all
      // tracking calls become no-ops until a connection string is provided.
      this.log.warn('telemetry.init.skipped', {
        reason: 'no connection string',
      });
      this.initialized = true;
      return;
    }

    try {
      // Dynamic import — the bundler emits a named `app-insights` chunk
      // loaded only when a connectionString is present. Webpack magic-comment
      // syntax also works on esbuild via the `webpackChunkName` hint.
      const { ApplicationInsights: AppInsightsCtor } = await import(
        /* webpackChunkName: "app-insights" */
        '@microsoft/applicationinsights-web'
      );

      this.appInsights = new AppInsightsCtor({
        config: {
          connectionString,
          samplingPercentage: this.runtime.telemetry.sampleRate * 100,
          disableAjaxTracking: false,
          disableFetchTracking: false,
          enableAutoRouteTracking: true,
          enableCorsCorrelation: true,
          // The SDK's "distributed tracing" emits a traceparent header we
          // keep; `correlationInterceptor` still stamps X-Correlation-ID so
          // both ids reach the backend.
          distributedTracingMode: 2, // W3C trace context
          loggingLevelConsole: environment.production ? 0 : 1,
        },
      });
      this.appInsights.loadAppInsights();
      this.applyReleaseTag();

      // Wire web-vitals — dynamic import so the dep stays out of the initial
      // bundle for sessions that fall outside the sample rate. Negligible
      // overhead (~12 kB gzipped) and defers the work until after bootstrap.
      await this.wireWebVitals();

      this.initialized = true;
      this.log.info('telemetry.init.ready');
    } catch (err) {
      // Never let a telemetry init error tank app bootstrap.
      this.log.error('telemetry.init.failed', { err });
      this.initialized = true;
    }
  }

  /**
   * Updates the principal on the SDK. Called whenever `AuthService.currentUser`
   * changes. Passing `null` clears the authenticated-user context (logout).
   */
  setUserContext(userId: string | null): void {
    this.currentUserId = userId;
    if (!this.appInsights) return;
    if (userId) {
      this.appInsights.setAuthenticatedUserContext(userId, undefined, true);
    } else {
      this.appInsights.clearAuthenticatedUserContext();
    }
  }

  // ── Tracking APIs ────────────────────────────────────────────────────

  trackError(error: unknown, extra: CommonEnvelope = {}): void {
    if (!this.appInsights) return;
    const properties = this.envelope(extra);
    const ex: IExceptionTelemetry = {
      exception: this.asError(error),
      properties: this.scrubProps(properties),
    };
    this.appInsights.trackException(ex);
  }

  trackEvent(name: string, properties: CommonEnvelope = {}): void {
    if (!this.appInsights) return;
    const event: IEventTelemetry = {
      name,
      properties: this.scrubProps(this.envelope(properties)),
    };
    this.appInsights.trackEvent(event);
  }

  trackPageView(name?: string, url?: string): void {
    if (!this.appInsights) return;
    const pv: IPageViewTelemetry = {
      name,
      uri: url,
      properties: this.scrubProps(this.envelope({})),
    };
    this.appInsights.trackPageView(pv);
  }

  trackMetric(
    name: string,
    value: number,
    properties: CommonEnvelope = {},
  ): void {
    if (!this.appInsights) return;
    const metric: IMetricTelemetry = {
      name,
      average: value,
      properties: this.scrubProps(this.envelope(properties)),
    };
    this.appInsights.trackMetric(metric);
  }

  /**
   * Forces any buffered telemetry to flush. Call from page-unload-style hooks
   * (or the `GlobalErrorHandler` when emitting fatal errors) to maximise the
   * chance a record reaches the backend before the tab closes.
   */
  flush(): void {
    this.appInsights?.flush(false);
  }

  // ── Web vitals ───────────────────────────────────────────────────────

  private async wireWebVitals(): Promise<void> {
    const rate = this.runtime.telemetry.webVitalsSampleRate;
    if (rate <= 0) return;

    // Sessions outside the sample rate don't import the package at all.
    if (Math.random() > rate) return;

    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import(
      /* webpackChunkName: "web-vitals" */
      'web-vitals'
    );

    const report = (metric: { name: string; value: number }): void => {
      const name = metric.name as WebVitalName;
      const withinBudget = isWithinBudget(name, metric.value);
      const budget =
        name === 'LCP'
          ? WEB_VITALS_BUDGETS.LCP_MS
          : name === 'INP'
            ? WEB_VITALS_BUDGETS.INP_MS
            : name === 'CLS'
              ? WEB_VITALS_BUDGETS.CLS
              : name === 'FCP'
                ? WEB_VITALS_BUDGETS.FCP_MS
                : WEB_VITALS_BUDGETS.TTFB_MS;
      this.trackMetric(`webvitals.${name}`, metric.value, {
        budget,
        withinBudget,
      });
    };

    onLCP(report);
    onINP(report);
    onCLS(report);
    onFCP(report);
    onTTFB(report);
  }

  // ── Internals ────────────────────────────────────────────────────────

  /** Stamps release + environment properties onto every record. */
  private applyReleaseTag(): void {
    if (!this.appInsights) return;
    this.appInsights.addTelemetryInitializer((item) => {
      const data = (item.baseData ??= {}) as Record<string, unknown>;
      const props = ((data['properties'] ??= {}) as Record<string, unknown>);
      props['release'] = this.tag.release;
      props['environment'] = this.tag.environment;
      return true;
    });
  }

  private envelope(extra: CommonEnvelope): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) continue;
      out[k] = v;
    }
    const correlationId = this.correlation.active();
    if (correlationId) out['correlationId'] = correlationId;
    if (this.currentUserId) out['userId'] = this.currentUserId;
    out['route'] = this.router.url;
    return out;
  }

  private scrubProps(
    props: Record<string, string | number | boolean>,
  ): Record<string, string> {
    // AI's API accepts string values only for `properties`. Scrub the whole
    // bag through LoggerService so emails / phone numbers / etc. get masked.
    const scrubbed = this.log.scrub(props) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(scrubbed)) {
      if (v === undefined || v === null) continue;
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }

  private asError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    try {
      return new Error(JSON.stringify(err));
    } catch {
      return new Error('Unknown error');
    }
  }
}
