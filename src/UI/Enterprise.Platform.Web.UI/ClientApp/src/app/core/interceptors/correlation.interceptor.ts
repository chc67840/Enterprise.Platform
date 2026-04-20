/**
 * ─── CORRELATION INTERCEPTOR ────────────────────────────────────────────────────
 *
 * WHY
 *   Every outbound request gets a correlation id — a short UUID the backend
 *   stamps onto its structured logs and OTEL spans. When a user reports
 *   "something went wrong", the support team can pivot from the frontend
 *   error (Sentry/App Insights) to the backend logs via this one id.
 *
 * HOW IT DECIDES
 *   1. If the caller already set `X-Correlation-ID` on the request (rare —
 *      typically only when tunnelling a broader span), pass it through.
 *   2. Otherwise mint a fresh UUID via `crypto.randomUUID()` (available in
 *      every evergreen browser, no polyfill needed).
 *
 *   A Phase-3 enhancement will read an ambient W3C `traceparent` span if
 *   OTEL-web is initialised, so correlation IDs line up 1:1 with trace IDs.
 *   Until then, plain UUIDs are sufficient for log pivots.
 *
 * CHAIN POSITION
 *   Runs immediately after MSAL (position #2). We want the correlation id on
 *   auth-related requests too, and we want it to be stamped BEFORE any other
 *   interceptor might log the request (logging interceptor is #6).
 *
 * PHASE 2.3 — CONTEXT PROPAGATION
 *   The interceptor also pushes the active id onto `CorrelationContextService`
 *   for the duration of the request pipeline so `LoggerService.log(...)`
 *   stamps the same id onto any structured record emitted while the request
 *   is in flight. The RxJS `finalize` block restores the previous id when
 *   the observable completes or errors.
 */
import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { CorrelationContextService } from '@core/services/correlation-context.service';

const CORRELATION_HEADER = 'X-Correlation-ID';

/** Generates a correlation id. `crypto.randomUUID` is widely supported. */
function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without `crypto.randomUUID` (e.g. some jsdom
  // configurations under test). Not cryptographically strong — that's fine,
  // correlation ids are not security tokens.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  const existing = req.headers.get(CORRELATION_HEADER);
  const id = existing ?? generateCorrelationId();
  const stampedReq = existing ? req : req.clone({ setHeaders: { [CORRELATION_HEADER]: id } });

  const ctx = inject(CorrelationContextService);
  const restore = ctx.pushActive(id);

  return next(stampedReq).pipe(finalize(() => restore()));
};
