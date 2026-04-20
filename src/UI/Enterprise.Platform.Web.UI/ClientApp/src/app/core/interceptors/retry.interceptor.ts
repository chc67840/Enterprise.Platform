/**
 * ─── RETRY INTERCEPTOR ──────────────────────────────────────────────────────────
 *
 * WHY
 *   Transient upstream failures (DNS hiccup, 503 gateway timeout, brief proxy
 *   restart) are not worth interrupting the user over. A bounded number of
 *   retries with exponential back-off + jitter recovers transparently in the
 *   vast majority of cases.
 *
 * POLICY
 *   - Retry only on 5xx (502 / 503 / 504 especially). 4xx are NOT transient
 *     — retrying a 400/401/403/422 just hammers the server to the same effect.
 *   - Retry only SAFE methods (GET / HEAD / OPTIONS). Replaying POST/PUT/
 *     PATCH/DELETE risks non-idempotent side-effects.
 *   - Honour `environment.http.retries` as the cap and
 *     `environment.http.retryDelayMs` as the base delay.
 *   - Exponential back-off with ±25% jitter so clients don't retry in a
 *     thundering herd when a service restarts.
 *
 * OPT-OUT
 *   Callers that want to see the first failure can set `X-Skip-Retry: true`
 *   on the request. The interceptor strips the header before forwarding.
 *
 * WHY NOT POLLY-STYLE POLICY OBJECT
 *   Overkill for frontend transient retries. Two knobs (max + base delay)
 *   cover every case we've needed. When we need per-feature retry policies,
 *   a policy argument goes into `BaseApiService.getAll(params, { retry: ... })`.
 *
 * CHAIN POSITION
 *   Position #9 — after logging (so the first attempt + each retry are
 *   both visible in logs) and before errorInterceptor (so a retried success
 *   never reaches the error interceptor at all).
 */
import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { throwError, timer } from 'rxjs';
import { mergeMap, retry } from 'rxjs/operators';

import { environment } from '@env/environment';

const SKIP_HEADER = 'X-Skip-Retry';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Exponential backoff with ±25% jitter. */
function computeDelayMs(attempt: number, baseMs: number): number {
  const exp = Math.min(attempt, 6); // cap exponent to keep delays sane
  const base = Math.pow(2, exp - 1) * baseMs; // 1×, 2×, 4×, 8×, 16×, 32× base
  const jitter = 1 + (Math.random() * 0.5 - 0.25); // ±25%
  return Math.round(base * jitter);
}

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(SKIP_HEADER)) {
    const cleanReq = req.clone({ headers: req.headers.delete(SKIP_HEADER) });
    return next(cleanReq);
  }

  const isSafe = SAFE_METHODS.has(req.method.toUpperCase());
  const maxRetries = environment.http.retries;
  const baseDelayMs = environment.http.retryDelayMs;

  if (!isSafe || maxRetries <= 0) {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: maxRetries,
      delay: (err: HttpErrorResponse, attempt: number) => {
        if (!RETRYABLE_STATUSES.has(err.status)) {
          // Non-retryable error — bail immediately.
          return throwError(() => err);
        }
        // `attempt` is 1-based in RxJS `retry.delay`.
        return timer(computeDelayMs(attempt, baseDelayMs)).pipe(mergeMap(() => [0]));
      },
    }),
  );
};
