/**
 * ─── CACHE INTERCEPTOR ──────────────────────────────────────────────────────────
 *
 * WHY
 *   Lots of GET traffic is repeat-reading the same static / slow-moving data:
 *   lookup lists ("all roles"), current user profile, feature flags, reference
 *   catalogs. A thin in-memory TTL cache at the HTTP boundary absorbs those
 *   reads without touching network.
 *
 * POLICY
 *   - GET only. Every non-GET request passes through untouched. Caching
 *     mutating methods would be a data-corruption bug.
 *   - Default TTL: **0** — caching is opt-IN. A request opts in by setting
 *     `X-Cache-TTL: <seconds>`. This keeps normal traffic unchanged; features
 *     that want caching mark it explicitly on the call site.
 *   - `X-Skip-Cache: true` forces a network hit AND refreshes the cache entry.
 *     Useful when a page knows its data is stale (e.g. after a successful
 *     create/update) but still wants subsequent reads cached.
 *   - Cache key = `<method>|<url-with-params>|<accept>`. Normalizing url+params
 *     ignores the order in which params were added.
 *
 * MEMORY
 *   Unbounded growth is not a risk in practice — we expire entries lazily on
 *   read. But we bound entry count at 200 (arbitrary, tunable) and evict
 *   least-recently-used when we'd cross the cap. That cap protects against
 *   runaway feature usage (e.g. a pathological dashboard querying per-tenant
 *   per-user per-minute).
 *
 * CHAIN POSITION
 *   Slot #5 — after security (so auth-gated cacheables include the right
 *   headers in the key) and BEFORE dedup / loading / logging / retry /
 *   errorInterceptor. Cache hits should never trip the loading bar and
 *   never reach the error interceptor.
 *
 * LIMITS
 *   - In-memory only. A page refresh flushes the cache — that's intentional.
 *     Persistence lives in `withPersistence` at the store layer (Phase 6.2.5).
 *   - Non-200 responses are not cached. Errors go through errorInterceptor.
 */
import {
  HttpHeaders,
  HttpResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { of, tap, type Observable } from 'rxjs';

const TTL_HEADER = 'X-Cache-TTL';
const SKIP_HEADER = 'X-Skip-Cache';

/** Maximum simultaneous cached entries before LRU eviction kicks in. */
const MAX_ENTRIES = 200;

interface CacheEntry {
  readonly body: unknown;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly expiresAt: number;
  /** Epoch ms of last read — drives LRU ordering. */
  lastReadAt: number;
}

/**
 * Module-level cache. Single instance shared across the tab (one HTTP
 * request graph). Exported for test hooks; production callers go through
 * the interceptor only.
 */
const cache = new Map<string, CacheEntry>();

export function __resetCacheInterceptorForTests(): void {
  cache.clear();
}

function cacheKey(req: HttpRequest<unknown>): string {
  const accept = req.headers.get('Accept') ?? '';
  const params = req.params.keys().sort().map((k) => `${k}=${req.params.get(k) ?? ''}`).join('&');
  return `${req.method}|${req.urlWithParams.split('?')[0]}|${params}|${accept}`;
}

function evictIfAtCap(): void {
  if (cache.size < MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTs = Number.POSITIVE_INFINITY;
  for (const [k, v] of cache) {
    if (v.lastReadAt < oldestTs) {
      oldestTs = v.lastReadAt;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) cache.delete(oldestKey);
}

function materialize(entry: CacheEntry): HttpResponse<unknown> {
  return new HttpResponse({
    body: entry.body,
    status: entry.status,
    statusText: entry.statusText,
    headers: new HttpHeaders(entry.headers),
  });
}

export const cacheInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  // Non-GETs + skipped requests always bypass. Strip headers before forwarding.
  if (req.method !== 'GET') {
    const clean = req.headers.has(TTL_HEADER) || req.headers.has(SKIP_HEADER)
      ? req.clone({
          headers: req.headers.delete(TTL_HEADER).delete(SKIP_HEADER),
        })
      : req;
    return next(clean);
  }

  const skip = req.headers.get(SKIP_HEADER);
  const ttlHeader = req.headers.get(TTL_HEADER);
  const ttlSeconds = ttlHeader ? Number.parseInt(ttlHeader, 10) : 0;
  // Strip our marker headers before forwarding — servers never see them.
  const stripped = req.clone({
    headers: req.headers.delete(TTL_HEADER).delete(SKIP_HEADER),
  });

  if (ttlSeconds <= 0) {
    // No opt-in — pass through without touching the cache.
    return next(stripped);
  }

  const key = cacheKey(req);
  const now = Date.now();

  if (skip !== 'true') {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      hit.lastReadAt = now;
      return of(materialize(hit));
    }
    if (hit) {
      // Expired — drop so we repopulate on the fresh response.
      cache.delete(key);
    }
  }

  return next(stripped).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) return;
      if (event.status < 200 || event.status >= 300) return;

      evictIfAtCap();
      const headers: Record<string, string> = {};
      for (const name of event.headers.keys()) {
        const v = event.headers.get(name);
        if (v !== null) headers[name] = v;
      }
      cache.set(key, {
        body: event.body,
        status: event.status,
        statusText: event.statusText,
        headers,
        expiresAt: now + ttlSeconds * 1000,
        lastReadAt: now,
      });
    }),
  );
};
