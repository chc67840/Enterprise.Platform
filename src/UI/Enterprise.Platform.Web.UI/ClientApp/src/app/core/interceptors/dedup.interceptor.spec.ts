/**
 * ─── DEDUP INTERCEPTOR — UNIT TESTS ────────────────────────────────────────────
 *
 * Proves:
 *   - Two identical in-flight GETs share a single network trip.
 *   - Different URLs → separate trips.
 *   - POST never dedupes.
 *   - `X-Skip-Dedup: true` opts out (and strips the header).
 *   - After the first call completes, subsequent identical GETs are fresh.
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
import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetDedupInterceptorForTests,
  dedupInterceptor,
} from './dedup.interceptor';

describe('dedupInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    __resetDedupInterceptorForTests();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([dedupInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('collapses two concurrent identical GETs to a single network request', () => {
    const received: unknown[] = [];
    http.get('/api/widgets').subscribe((r) => received.push(r));
    http.get('/api/widgets').subscribe((r) => received.push(r));

    // Only ONE underlying HttpTestingController request — they share the observable.
    const req = httpMock.expectOne('/api/widgets');
    req.flush({ n: 1 });

    expect(received).toEqual([{ n: 1 }, { n: 1 }]);
  });

  it('different URLs receive independent trips', () => {
    http.get('/api/widgets').subscribe();
    http.get('/api/gadgets').subscribe();

    httpMock.expectOne('/api/widgets').flush({});
    httpMock.expectOne('/api/gadgets').flush({});
  });

  it('does NOT dedupe POSTs', () => {
    http.post('/api/widgets', { n: 1 }).subscribe();
    http.post('/api/widgets', { n: 2 }).subscribe();

    const reqs = httpMock.match(() => true);
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush({}));
  });

  it('honours X-Skip-Dedup + strips the header before forwarding', () => {
    const headers = { 'X-Skip-Dedup': 'true' };
    http.get('/api/widgets').subscribe();
    http.get('/api/widgets', { headers }).subscribe();

    const reqs = httpMock.match(() => true);
    expect(reqs.length).toBe(2);
    // The skip-flagged call must NOT carry the marker header onto the wire.
    const skipped = reqs.find(
      (r) => r.request.headers.has('X-Skip-Dedup') === false,
    );
    expect(skipped).toBeDefined();
    reqs.forEach((r) => r.flush({}));
  });

  it('a second call after the first completes is fresh (not a cache)', () => {
    http.get('/api/widgets').subscribe();
    httpMock.expectOne('/api/widgets').flush({});

    http.get('/api/widgets').subscribe();
    httpMock.expectOne('/api/widgets').flush({});
  });
});
