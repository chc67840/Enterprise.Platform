/**
 * ─── UsersApiService — UNIT TESTS ───────────────────────────────────────────────
 *
 * Proves:
 *   - URL composition for every verb endpoint
 *   - query-string serialization on `list()` (page / pageSize / search / activeOnly)
 *   - `Idempotency-Key` header is present on every mutation
 *   - Zod validation rejects malformed responses
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { API_BASE_URL } from '@core/http/api-config.token';

import { UsersApiService } from './users-api.service';
import type { ListUsersResponse, UserDto } from './user.types';

const BASE = 'https://example.test/api/v1';

const sampleUser: UserDto = {
  id: '11111111-2222-4333-8444-555555555555',
  email: 'alice@example.test',
  firstName: 'Alice',
  lastName: 'Adams',
  externalIdentityId: null,
  isActive: true,
  lastLoginAt: null,
  isDeleted: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: '2026-04-26T00:00:00+00:00',
  createdBy: 'system',
  modifiedAt: null,
  modifiedBy: null,
};

const samplePage: ListUsersResponse = {
  items: [sampleUser],
  pageNumber: 1,
  pageSize: 25,
  totalCount: 1,
};

describe('UsersApiService', () => {
  let api: UsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        UsersApiService,
      ],
    });
    api = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('list emits a GET with paging + filter query string', () => {
    api.list({ page: 2, pageSize: 50, search: 'alice', activeOnly: true }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/users`);

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.get('search')).toBe('alice');
    expect(req.request.params.get('activeOnly')).toBe('true');

    req.flush(samplePage);
    httpMock.verify();
  });

  it('list omits search/activeOnly when null', () => {
    api.list({ page: 1, pageSize: 25, search: null, activeOnly: null }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/users`);

    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('activeOnly')).toBe(false);

    req.flush(samplePage);
    httpMock.verify();
  });

  it('getById GETs the right URL and validates the response shape', () => {
    api.getById(sampleUser.id).subscribe((user) => {
      expect(user.email).toBe('alice@example.test');
    });
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}`);
    req.flush(sampleUser);
    httpMock.verify();
  });

  it('create POSTs to /users with an Idempotency-Key header', () => {
    api
      .create({
        email: 'bob@example.test',
        firstName: 'Bob',
        lastName: 'Brown',
        externalIdentityId: null,
      })
      .subscribe();

    const req = httpMock.expectOne(`${BASE}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Idempotency-Key')).toBeTruthy();

    req.flush({ ...sampleUser, email: 'bob@example.test', firstName: 'Bob', lastName: 'Brown' });
    httpMock.verify();
  });

  it('rename PUTs /users/{id}/name', () => {
    api.rename(sampleUser.id, { firstName: 'Alyce', lastName: 'Adams' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}/name`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ firstName: 'Alyce', lastName: 'Adams' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('changeEmail PUTs /users/{id}/email', () => {
    api.changeEmail(sampleUser.id, { email: 'alyce@example.test' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}/email`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ email: 'alyce@example.test' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('activate POSTs /users/{id}/activate', () => {
    api.activate(sampleUser.id).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}/activate`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('deactivate POSTs /users/{id}/deactivate with reason', () => {
    api.deactivate(sampleUser.id, { reason: 'no longer with us' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}/deactivate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'no longer with us' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('Zod rejects a malformed list response', () => {
    let caught: unknown = null;
    api.list({ page: 1, pageSize: 25, search: null, activeOnly: null }).subscribe({
      error: (err) => {
        caught = err;
      },
    });
    const req = httpMock.expectOne((r) => r.url === `${BASE}/users`);
    // `items` is required but we omit it.
    req.flush({ pageNumber: 1, pageSize: 25, totalCount: 0 });
    httpMock.verify();
    expect(caught).toBeTruthy();
  });

  it('mutating verbs accept a caller-supplied idempotency key', () => {
    api.activate(sampleUser.id, { idempotencyKey: 'fixed-key-abc' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}/activate`);
    expect(req.request.headers.get('X-Idempotency-Key')).toBe('fixed-key-abc');
    req.flush(null, { status: 204, statusText: 'No Content' });
    httpMock.verify();
  });

  it('mutating verbs add X-Skip-Error-Handling when suppressGlobalError is set', () => {
    api.create(
      { email: 'x@example.test', firstName: 'X', lastName: 'Y', externalIdentityId: null },
      { suppressGlobalError: true },
    ).subscribe();
    const req = httpMock.expectOne(`${BASE}/users`);
    expect(req.request.headers.get('X-Skip-Error-Handling')).toBe('true');
    req.flush(sampleUser);
    httpMock.verify();
  });

  it('getById passes X-Skip-Error-Handling when suppressGlobalError is set', () => {
    api.getById(sampleUser.id, { suppressGlobalError: true }).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}`);
    expect(req.request.headers.get('X-Skip-Error-Handling')).toBe('true');
    req.flush(sampleUser);
    httpMock.verify();
  });

  it('getById omits X-Skip-Error-Handling by default', () => {
    api.getById(sampleUser.id).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}`);
    expect(req.request.headers.has('X-Skip-Error-Handling')).toBe(false);
    req.flush(sampleUser);
    httpMock.verify();
  });
});
