/**
 * ─── CORRELATION INTERCEPTOR — UNIT TESTS ───────────────────────────────────────
 *
 * Phase 3.4 scope — proves:
 *   - A fresh UUID is minted when the caller omits `X-Correlation-ID`.
 *   - An existing caller-supplied id passes through unchanged.
 *   - The ambient `CorrelationContextService.active()` reports the id while
 *     the request is in-flight and is cleared on completion (both success
 *     and error paths).
 *
 * The end-to-end check (SPA → backend shares the same id) is a runbook
 * procedure, since live cross-tier assertions require a running backend. See
 * `Docs/Observability/correlation-runbook.md`.
 */
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CorrelationContextService } from '@core/services/correlation-context.service';

import { correlationInterceptor } from './correlation.interceptor';

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let ctx: CorrelationContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    ctx = TestBed.inject(CorrelationContextService);
  });

  it('stamps a fresh X-Correlation-ID header when none is set by the caller', () => {
    http.get('/api/probe').subscribe();

    const req = httpMock.expectOne('/api/probe');
    const id = req.request.headers.get('X-Correlation-ID');
    expect(id).toBeTruthy();
    // UUID v4 shape: 36 chars with dashes at fixed offsets (or the timestamp
    // fallback when crypto.randomUUID isn't available). Either way the header
    // must be non-empty.
    expect(id!.length).toBeGreaterThan(8);
    req.flush({});
  });

  it('passes through an existing X-Correlation-ID without overwriting', () => {
    const supplied = 'abc123-upstream';
    http.get('/api/probe', {
      headers: { 'X-Correlation-ID': supplied },
    }).subscribe();

    const req = httpMock.expectOne('/api/probe');
    expect(req.request.headers.get('X-Correlation-ID')).toBe(supplied);
    req.flush({});
  });

  it('exposes the active correlation id on the context while the request is in flight', () => {
    http.get('/api/probe').subscribe();
    const req = httpMock.expectOne('/api/probe');
    const observedWhileInFlight = ctx.active();
    const headerId = req.request.headers.get('X-Correlation-ID');

    expect(observedWhileInFlight).toBe(headerId);

    req.flush({});
    expect(ctx.active()).toBeNull();
  });

  it('clears the active id after an error response too', () => {
    http.get('/api/probe').subscribe({
      error: () => {
        /* noop — we only care the finalize unwinds */
      },
    });
    const req = httpMock.expectOne('/api/probe');
    expect(ctx.active()).toBeTruthy();

    req.flush('boom', { status: 500, statusText: 'Server Error' });
    expect(ctx.active()).toBeNull();
  });

  it('round-trips the error into the subscriber as an HttpErrorResponse', () => {
    let captured: unknown;
    http.get('/api/probe').subscribe({
      error: (err) => {
        captured = err;
      },
    });
    const req = httpMock.expectOne('/api/probe');
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    expect(captured).toBeInstanceOf(HttpErrorResponse);
  });
});
