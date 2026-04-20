/**
 * ─── RETRY INTERCEPTOR — UNIT TESTS ─────────────────────────────────────────────
 *
 * Proves:
 *   - 5xx on a GET triggers retries (up to the environment cap).
 *   - 4xx on a GET is NOT retried (pass straight through).
 *   - Non-safe methods (POST) are never retried regardless of status.
 *   - `X-Skip-Retry: true` short-circuits + strips the header.
 *
 * NOTE
 *   Exponential-backoff delays use `Math.random()` jitter; we don't unit-test
 *   the precise wait — that would couple the spec to implementation detail
 *   and force a fake-timer harness. Instead we verify the retry COUNT which
 *   is the observable contract.
 */
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { retryInterceptor } from './retry.interceptor';

describe('retryInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Fake timers so the rxjs `timer()` delays between retries fire
    // synchronously under test control.
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a failing GET on 503 up to the env cap', async () => {
    const subscriber = vi.fn();
    http.get('/api/probe').subscribe({
      next: subscriber,
      error: subscriber,
    });

    // First attempt.
    let req = httpMock.expectOne('/api/probe');
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    // Advance timers to trigger retry 1.
    await vi.advanceTimersByTimeAsync(5_000);
    req = httpMock.expectOne('/api/probe');
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    // Retry 2.
    await vi.advanceTimersByTimeAsync(10_000);
    req = httpMock.expectOne('/api/probe');
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    // Retry 3 — last one allowed by default env (retries: 3).
    await vi.advanceTimersByTimeAsync(20_000);
    req = httpMock.expectOne('/api/probe');
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    // Subscriber should now see the error (no more retries).
    expect(subscriber).toHaveBeenCalled();
    httpMock.verify();
  });

  it('does NOT retry a 404', () => {
    const onError = vi.fn();
    http.get('/api/missing').subscribe({ error: onError });

    const req = httpMock.expectOne('/api/missing');
    req.flush('not found', { status: 404, statusText: 'Not Found' });

    expect(onError).toHaveBeenCalled();
    httpMock.verify();
  });

  it('does NOT retry a POST even on 503', () => {
    const onError = vi.fn();
    http.post('/api/submit', { foo: 1 }).subscribe({ error: onError });

    const req = httpMock.expectOne('/api/submit');
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    expect(onError).toHaveBeenCalled();
    httpMock.verify();
  });

  it('honours X-Skip-Retry and strips the header before forwarding', () => {
    const onError = vi.fn();
    http
      .get('/api/probe', { headers: { 'X-Skip-Retry': 'true' } })
      .subscribe({ error: onError });

    const req = httpMock.expectOne('/api/probe');
    // Header must not leak to the server.
    expect(req.request.headers.has('X-Skip-Retry')).toBe(false);
    req.flush('down', { status: 503, statusText: 'Service Unavailable' });

    expect(onError).toHaveBeenCalled();
    httpMock.verify();
  });
});
