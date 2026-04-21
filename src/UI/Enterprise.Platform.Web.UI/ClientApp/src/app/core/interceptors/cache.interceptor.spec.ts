/**
 * ─── CACHE INTERCEPTOR — UNIT TESTS ────────────────────────────────────────────
 *
 * Proves:
 *   - Without `X-Cache-TTL` → pass-through (no cache).
 *   - With `X-Cache-TTL: n` + cold → network hit + entry cached, header stripped.
 *   - With `X-Cache-TTL: n` + warm within TTL → second call short-circuits to cache (no network).
 *   - Expired entry → cache miss → fresh fetch.
 *   - `X-Skip-Cache: true` → force network hit, refresh cache entry.
 *   - Non-GET → pass-through untouched.
 *   - Non-2xx responses are NOT cached.
 */
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetCacheInterceptorForTests,
  cacheInterceptor,
} from './cache.interceptor';

describe('cacheInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T00:00:00Z'));
    __resetCacheInterceptorForTests();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cacheInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through when no X-Cache-TTL is present', () => {
    http.get('/api/widgets').subscribe();
    const req = httpMock.expectOne('/api/widgets');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });

  it('caches a response on first hit + strips the TTL header before forwarding', () => {
    const headers = { 'X-Cache-TTL': '60' };

    http.get('/api/widgets', { headers }).subscribe();
    const first = httpMock.expectOne('/api/widgets');
    // Marker headers must never reach the server.
    expect(first.request.headers.has('X-Cache-TTL')).toBe(false);
    expect(first.request.headers.has('X-Skip-Cache')).toBe(false);
    first.flush({ items: ['a'] });

    // Second identical call within TTL short-circuits to cache (no httpMock hit).
    let received: unknown = null;
    http.get<{ items: string[] }>('/api/widgets', { headers }).subscribe((r) => {
      received = r;
    });
    httpMock.expectNone('/api/widgets');
    expect(received).toEqual({ items: ['a'] });
  });

  it('refetches after TTL elapses', () => {
    const headers = { 'X-Cache-TTL': '5' };

    http.get('/api/widgets', { headers }).subscribe();
    httpMock.expectOne('/api/widgets').flush({ n: 1 });

    // Advance past TTL (+ a bit).
    vi.advanceTimersByTime(6_000);

    http.get('/api/widgets', { headers }).subscribe();
    const refreshed = httpMock.expectOne('/api/widgets');
    refreshed.flush({ n: 2 });
  });

  it('X-Skip-Cache forces a network hit even when cached', () => {
    const cached = { 'X-Cache-TTL': '60' };
    const bypass = { 'X-Cache-TTL': '60', 'X-Skip-Cache': 'true' };

    // Seed the cache.
    http.get('/api/widgets', { headers: cached }).subscribe();
    httpMock.expectOne('/api/widgets').flush({ n: 1 });

    // Skip forces network hit.
    http.get('/api/widgets', { headers: bypass }).subscribe();
    const forced = httpMock.expectOne('/api/widgets');
    expect(forced.request.headers.has('X-Skip-Cache')).toBe(false);
    forced.flush({ n: 2 });

    // Next call without skip sees the refreshed entry.
    let received: unknown = null;
    http.get<{ n: number }>('/api/widgets', { headers: cached }).subscribe((r) => {
      received = r;
    });
    httpMock.expectNone('/api/widgets');
    expect(received).toEqual({ n: 2 });
  });

  it('does NOT touch non-GET requests', () => {
    const headers = { 'X-Cache-TTL': '60' };
    http.post('/api/widgets', { foo: 1 }, { headers }).subscribe();
    const req = httpMock.expectOne('/api/widgets');
    expect(req.request.method).toBe('POST');
    // Even though TTL was set, POST bypasses the cache entirely.
    expect(req.request.headers.has('X-Cache-TTL')).toBe(false);
    req.flush({ ok: true });

    http.post('/api/widgets', { foo: 2 }, { headers }).subscribe();
    httpMock.expectOne('/api/widgets').flush({ ok: true });
  });

  it('does NOT cache non-2xx responses', () => {
    const headers = { 'X-Cache-TTL': '60' };

    http.get('/api/widgets', { headers }).subscribe({ error: () => {} });
    const first = httpMock.expectOne('/api/widgets');
    first.flush('down', { status: 503, statusText: 'Service Unavailable' });

    // Next call bypasses cache because the previous response failed.
    http.get('/api/widgets', { headers }).subscribe();
    httpMock.expectOne('/api/widgets').flush({ items: [] });
  });
});
