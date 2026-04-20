/**
 * ─── LOADING INTERCEPTOR — UNIT TESTS ───────────────────────────────────────────
 *
 * Proves the counter stays balanced:
 *   - Start of request → `inFlight` increments by 1.
 *   - Successful response → `inFlight` decrements by 1.
 *   - Error response → still decrements by 1 (finalize runs on both).
 *   - `X-Skip-Loading: true` short-circuits the counter + strips the header.
 */
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoadingService } from '@core/services/loading.service';

import { loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });

  it('increments then decrements for a successful request', () => {
    expect(loading.inFlight()).toBe(0);
    http.get('/api/probe').subscribe();
    const req = httpMock.expectOne('/api/probe');
    expect(loading.inFlight()).toBe(1);

    req.flush({});
    expect(loading.inFlight()).toBe(0);
    expect(loading.isLoading()).toBe(false);
  });

  it('decrements even when the request errors', () => {
    http.get('/api/probe').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/probe');
    expect(loading.inFlight()).toBe(1);

    req.flush('boom', { status: 500, statusText: 'Server Error' });
    expect(loading.inFlight()).toBe(0);
  });

  it('keeps the counter stable across concurrent calls', () => {
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();
    expect(loading.inFlight()).toBe(2);

    const reqs = httpMock.match(() => true);
    reqs[0]!.flush({});
    expect(loading.inFlight()).toBe(1);
    reqs[1]!.flush({});
    expect(loading.inFlight()).toBe(0);
  });

  it('honours X-Skip-Loading and strips the header before forwarding', () => {
    http.get('/api/silent', { headers: { 'X-Skip-Loading': 'true' } }).subscribe();
    const req = httpMock.expectOne('/api/silent');
    // Opt-out header must not reach the server.
    expect(req.request.headers.has('X-Skip-Loading')).toBe(false);
    // Counter untouched.
    expect(loading.inFlight()).toBe(0);
    req.flush({});
  });
});
