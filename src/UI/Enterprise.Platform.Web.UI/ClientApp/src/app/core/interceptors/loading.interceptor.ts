/**
 * ─── LOADING INTERCEPTOR ────────────────────────────────────────────────────────
 *
 * WHY
 *   The `GlobalProgressBarComponent` (Phase 5) binds to `LoadingService.isLoading`.
 *   That signal should be `true` if and only if at least one HTTP request is
 *   currently in flight. This interceptor is the bookkeeper that makes that so.
 *
 * HOW
 *   On request start: increment the loading service's counter.
 *   On request completion (success OR error): decrement — `finalize()` runs
 *   on both paths, keeping the counter balanced even when a request throws.
 *
 * OPT-OUT
 *   Some calls shouldn't drive the global bar:
 *     - Silent background polls (e.g. session heartbeat)
 *     - Dedup-suppressed calls (reuse in-flight response)
 *     - User-triggered calls that have their own inline spinner
 *
 *   Such callers set `X-Skip-Loading: true` on the request. The interceptor
 *   strips the header before forwarding (so servers never see it) and
 *   bypasses the counter.
 *
 * CHAIN POSITION
 *   Position #7 — after the request is fully shaped (correlation/tenant/
 *   security/cache/dedup all resolved) but BEFORE logging/retry/error so the
 *   progress bar shows for the duration of any retries.
 */
import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { LoadingService } from '@core/services/loading.service';

const SKIP_HEADER = 'X-Skip-Loading';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Strip the opt-out header before forwarding — servers never see it.
  if (req.headers.has(SKIP_HEADER)) {
    const cleanReq = req.clone({ headers: req.headers.delete(SKIP_HEADER) });
    return next(cleanReq);
  }

  const loading = inject(LoadingService);
  loading.inc();
  return next(req).pipe(finalize(() => loading.dec()));
};
