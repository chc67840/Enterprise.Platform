/**
 * ─── AuthStore — UNIT TESTS ─────────────────────────────────────────────────────
 *
 * Proves the contract that permission/role guards + directives depend on:
 *   - hydrate() success patches roles / permissions / tenantId / bypass.
 *   - hydrate() error preserves existing state + captures error.
 *   - TTL → `isStale()` flips true when the clock passes `expiresAt`.
 *   - hasAnyPermission / hasAllPermissions: case-insensitive, OR / AND.
 *   - `bypass: true` short-circuits permission checks — but NOT role checks.
 *   - hasRole / hasAnyRole: case-insensitive.
 *   - reset() clears everything + notifies TenantService.
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

import { AuthStore } from './auth.store';
import { API_BASE_URL } from '@core/http/api-config.token';
import type { EffectivePermissions } from '@core/models';
import { TenantService } from '@core/services/tenant.service';

const BASE = 'https://example.test/api/v1';

describe('AuthStore', () => {
  let store: ReturnType<typeof TestBed.inject<typeof AuthStore>> extends infer X ? X : never;
  let httpMock: HttpTestingController;
  let tenant: TenantService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
    tenant = TestBed.inject(TenantService);
    TestBed.inject(HttpClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function hydrateWith(payload: EffectivePermissions): void {
    store.hydrate();
    const req = httpMock.expectOne(`${BASE}/me/permissions`);
    req.flush(payload);
  }

  it('hydrate patches roles / permissions / tenantId / bypass on 200', () => {
    hydrateWith({
      roles: ['admin', 'manager'],
      permissions: ['users:read', 'users:update'],
      tenantId: 't1',
      bypass: false,
      ttlSeconds: 60,
    });

    expect(store.roles()).toEqual(['admin', 'manager']);
    expect(store.permissions()).toEqual(['users:read', 'users:update']);
    expect(store.tenantId()).toBe('t1');
    expect(store.bypass()).toBe(false);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    // TenantService is notified so the tenantInterceptor sees the id.
    expect(tenant.current()).toBe('t1');
  });

  it('isStale() flips to true after expiresAt elapses (Phase 6.2.1 reactivity fix)', () => {
    // Phase 6.2.1 converted `isStale` from a `computed` to a method so the
    // `Date.now()` comparison re-evaluates on every call. Advancing the fake
    // clock past the TTL must flip the method's return value.
    hydrateWith({
      roles: [],
      permissions: [],
      tenantId: null,
      bypass: false,
      ttlSeconds: 10,
    });
    expect(store.isStale()).toBe(false);

    vi.advanceTimersByTime(11_000);
    expect(store.isStale()).toBe(true);
  });

  it('hydrate error preserves prior state + captures the error message', () => {
    hydrateWith({
      roles: ['admin'],
      permissions: ['users:read'],
      tenantId: 't1',
      bypass: false,
      ttlSeconds: 60,
    });

    store.hydrate();
    httpMock.expectOne(`${BASE}/me/permissions`).flush('boom', {
      status: 500,
      statusText: 'Server Error',
    });

    // Roles / permissions persist from the successful hydrate.
    expect(store.roles()).toEqual(['admin']);
    expect(store.permissions()).toEqual(['users:read']);
    expect(store.error()).toBeTruthy();
  });

  it('hasAnyPermission is OR-semantics and case-insensitive', () => {
    hydrateWith({
      roles: [],
      permissions: ['Users:Read'],
      tenantId: null,
      bypass: false,
    });
    expect(store.hasAnyPermission('users:read')).toBe(true);
    expect(store.hasAnyPermission('USERS:READ', 'misses')).toBe(true);
    expect(store.hasAnyPermission('misses:only')).toBe(false);
  });

  it('hasAllPermissions is AND-semantics and case-insensitive', () => {
    hydrateWith({
      roles: [],
      permissions: ['users:read', 'users:update'],
      tenantId: null,
      bypass: false,
    });
    expect(store.hasAllPermissions('USERS:READ', 'users:update')).toBe(true);
    expect(store.hasAllPermissions('users:read', 'users:delete')).toBe(false);
  });

  it('bypass: true short-circuits permission checks', () => {
    hydrateWith({
      roles: [],
      permissions: [],
      tenantId: null,
      bypass: true,
    });
    expect(store.hasAnyPermission('anything:at:all')).toBe(true);
    expect(store.hasAllPermissions('a', 'b')).toBe(true);
  });

  it('bypass does NOT grant role checks', () => {
    hydrateWith({
      roles: [],
      permissions: [],
      tenantId: null,
      bypass: true,
    });
    expect(store.hasRole('admin')).toBe(false);
    expect(store.hasAnyRole('admin', 'manager')).toBe(false);
  });

  it('hasRole + hasAnyRole are case-insensitive', () => {
    hydrateWith({
      roles: ['Admin'],
      permissions: [],
      tenantId: null,
      bypass: false,
    });
    expect(store.hasRole('admin')).toBe(true);
    expect(store.hasRole('ADMIN')).toBe(true);
    expect(store.hasAnyRole('manager', 'ADMIN')).toBe(true);
    expect(store.hasAnyRole('viewer')).toBe(false);
  });

  it('reset clears state + notifies TenantService', () => {
    hydrateWith({
      roles: ['admin'],
      permissions: ['users:read'],
      tenantId: 't1',
      bypass: false,
    });
    store.reset();

    expect(store.roles()).toEqual([]);
    expect(store.permissions()).toEqual([]);
    expect(store.tenantId()).toBeNull();
    expect(store.bypass()).toBe(false);
    expect(tenant.current()).toBeNull();
  });
});
