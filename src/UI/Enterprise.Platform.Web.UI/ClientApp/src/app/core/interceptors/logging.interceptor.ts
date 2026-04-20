/**
 * ─── LOGGING INTERCEPTOR ────────────────────────────────────────────────────────
 *
 * WHY
 *   Dev-time visibility. Emits one structured log per HTTP request/response
 *   so developers can see what the UI is asking for, what came back, and how
 *   long it took — without opening the Network tab.
 *
 * WHAT GETS LOGGED
 *   On request start:
 *     { http.request: { method, url } }
 *   On response (success):
 *     { http.response: { method, url, status, durationMs } }
 *   On response (error):
 *     { http.error: { method, url, status, durationMs, error } }  (via LoggerService.warn)
 *
 *   The `LoggerService` scrubs PII from any object passed to it, so
 *   accidentally logging a body that contains emails/phones is safe.
 *
 * PRODUCTION BEHAVIOUR
 *   `LoggerService` no-ops debug/info when `environment.features.enableLogging`
 *   is `false` — production builds drop these logs entirely. That means this
 *   interceptor imposes zero runtime cost in prod beyond the operator wrap.
 *
 *   For error paths we still call `warn`, which always logs. That's
 *   intentional: HTTP errors are interesting even in prod (Sentry / App
 *   Insights will surface them in Phase 3).
 *
 * CHAIN POSITION
 *   Position #8 — after the loading counter increments, so the log line's
 *   durationMs matches what the user actually experienced including retries.
 */
import { type HttpErrorResponse, type HttpEvent, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { type Observable, tap } from 'rxjs';

import { LoggerService } from '@core/services/logger.service';

export const loggingInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const log = inject(LoggerService);
  const startedAt = performance.now();

  log.debug('http.request', { method: req.method, url: req.urlWithParams });

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const durationMs = Math.round(performance.now() - startedAt);
          log.info('http.response', {
            method: req.method,
            url: req.urlWithParams,
            status: event.status,
            durationMs,
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        const durationMs = Math.round(performance.now() - startedAt);
        log.warn('http.error', {
          method: req.method,
          url: req.urlWithParams,
          status: err.status,
          durationMs,
          error: err,
        });
      },
    }),
  );
};
