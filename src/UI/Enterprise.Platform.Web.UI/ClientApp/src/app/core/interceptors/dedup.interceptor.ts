/**
 * ─── DEDUP INTERCEPTOR ──────────────────────────────────────────────────────────
 *
 * WHY
 *   Two places often fire the same `GET` within milliseconds of each other:
 *
 *     - A feature's store loads an entity while a shared-header component
 *       binds to the same id (e.g. current-user widget + profile page).
 *     - Route guards run eagerly in parallel on nested routes and each
 *       resolve a shared lookup.
 *
 *   Without dedup both fire independently — double the server load for no
 *   product benefit. This interceptor is a **single-flight** gate: while a
 *   `GET` for a given key is in flight, subsequent identical requests share
 *   the same Observable (and thus the same eventual response body).
 *
 * POLICY
 *   - GET only. Dedupling mutations would collapse unique user actions.
 *   - Key = `<method>|<url-with-sorted-params>|<accept>`. Matches the cache
 *     key so the two interceptors agree on "identical".
 *   - `X-Skip-Dedup: true` opts out — for polling or streams where each
 *     call's timing matters.
 *   - Once the first call resolves (success OR error), the shared observable
 *     is removed so the next call is fresh.
 *
 * CHAIN POSITION
 *   Slot #6 — after cache (a cache hit short-circuits dedup entirely) and
 *   before loading/logging/retry/error. Dedup-suppressed calls MUST still
 *   flow through logging so you can see the single underlying network trip.
 *
 * WHY NOT A SERVICE
 *   Interceptors already see every request in one place. Hoisting this to a
 *   service would require every call site to go through it; a chain-level
 *   implementation is the smaller surface.
 */
import {
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { finalize, share, type Observable } from 'rxjs';

const SKIP_HEADER = 'X-Skip-Dedup';

/** Active in-flight observables keyed by request signature. */
const inFlight = new Map<string, Observable<HttpEvent<unknown>>>();

export function __resetDedupInterceptorForTests(): void {
  inFlight.clear();
}

function key(req: HttpRequest<unknown>): string {
  const accept = req.headers.get('Accept') ?? '';
  const params = req.params.keys().sort().map((k) => `${k}=${req.params.get(k) ?? ''}`).join('&');
  return `${req.method}|${req.urlWithParams.split('?')[0]}|${params}|${accept}`;
}

export const dedupInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (req.method !== 'GET') {
    return next(req);
  }

  if (req.headers.get(SKIP_HEADER) === 'true') {
    const clean = req.clone({ headers: req.headers.delete(SKIP_HEADER) });
    return next(clean);
  }

  const k = key(req);
  const existing = inFlight.get(k);
  if (existing) {
    return existing;
  }

  const shared = next(req).pipe(
    // `share()` multicasts one source subscription to N subscribers, so every
    // caller sees the same sequence of emissions from the single network trip.
    share(),
    finalize(() => inFlight.delete(k)),
  );
  inFlight.set(k, shared);
  return shared;
};
