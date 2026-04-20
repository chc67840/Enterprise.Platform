/**
 * ─── SECURITY INTERCEPTOR — UNIT TESTS ──────────────────────────────────────────
 *
 * Proves:
 *   - `X-Requested-With: XMLHttpRequest` + `X-Content-Type-Options: nosniff`
 *     attached on every `/api/` call.
 *   - `X-XSRF-TOKEN` echo when the `XSRF-TOKEN` cookie is present.
 *   - External URLs are left untouched.
 *   - URL-encoded cookie values are decoded before echoing.
 */
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { securityInterceptor } from './security.interceptor';

/** Writes a cookie the interceptor's `document.cookie` read can see. */
function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('securityInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([securityInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearCookie('XSRF-TOKEN');
  });

  it('stamps X-Requested-With and X-Content-Type-Options on /api/ calls', () => {
    http.get('/api/v1/anything').subscribe();
    const req = httpMock.expectOne('/api/v1/anything');
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.get('X-Content-Type-Options')).toBe('nosniff');
    req.flush({});
  });

  it('echoes XSRF-TOKEN cookie as X-XSRF-TOKEN header when present', () => {
    setCookie('XSRF-TOKEN', 'abc123+xyz');
    http.get('/api/v1/anything').subscribe();
    const req = httpMock.expectOne('/api/v1/anything');
    // URL-decoded token — the cookie value is always URL-encoded on the wire.
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('abc123+xyz');
    req.flush({});
  });

  it('omits X-XSRF-TOKEN when the cookie is absent', () => {
    http.get('/api/v1/anything').subscribe();
    const req = httpMock.expectOne('/api/v1/anything');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush({});
  });

  it('leaves external URLs untouched', () => {
    setCookie('XSRF-TOKEN', 'abc');
    http.get('https://graph.microsoft.com/v1.0/me').subscribe();
    const req = httpMock.expectOne('https://graph.microsoft.com/v1.0/me');
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush({});
  });
});
