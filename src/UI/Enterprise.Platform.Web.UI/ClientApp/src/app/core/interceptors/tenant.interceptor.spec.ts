/**
 * ─── TENANT INTERCEPTOR — UNIT TESTS ────────────────────────────────────────────
 *
 * Proves:
 *   - Attaches `X-Tenant-ID` to calls hitting our `/api/` URL.
 *   - Skips the header on external URLs (MS Graph, CDN, etc.).
 *   - Skips when no tenant is resolved (unauthenticated / bootstrap calls).
 *   - Leaves the request untouched in every skip path.
 */
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TenantService } from '@core/services/tenant.service';

import { tenantInterceptor } from './tenant.interceptor';

describe('tenantInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tenant: TenantService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tenant = TestBed.inject(TenantService);
  });

  it('attaches X-Tenant-ID to /api/ calls when a tenant is resolved', () => {
    tenant.setTenant('11111111-2222-3333-4444-555555555555');
    http.get('/api/v1/users').subscribe();

    const req = httpMock.expectOne('/api/v1/users');
    expect(req.request.headers.get('X-Tenant-ID')).toBe(
      '11111111-2222-3333-4444-555555555555',
    );
    req.flush({});
  });

  it('does NOT attach the header when no tenant is resolved', () => {
    tenant.setTenant(null);
    http.get('/api/v1/users').subscribe();

    const req = httpMock.expectOne('/api/v1/users');
    expect(req.request.headers.has('X-Tenant-ID')).toBe(false);
    req.flush({});
  });

  it('does NOT attach the header to external URLs even when a tenant is set', () => {
    tenant.setTenant('tenant-id');
    // MS Graph / CDN-style — not under /api/.
    http.get('https://graph.microsoft.com/v1.0/me').subscribe();

    const req = httpMock.expectOne('https://graph.microsoft.com/v1.0/me');
    expect(req.request.headers.has('X-Tenant-ID')).toBe(false);
    req.flush({});
  });
});
