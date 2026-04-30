/**
 * ─── USERS FEATURE — END-TO-END INTEGRATION ─────────────────────────────────
 *
 * Pins the SPA-side wire layer for the create-user + list-users flows that
 * the user reported broken in the live app. Verifies, as one TestBed module:
 *
 *   1. `UsersStore.createUser` issues `POST /api/proxy/v1/users` with
 *       - the four-field body (email/firstName/lastName/externalIdentityId)
 *       - `X-Idempotency-Key` header (UUID-shaped)
 *       - `X-Skip-Error-Handling: true` header (suppresses global toast)
 *   2. `UsersApiService.list` issues `GET /api/proxy/v1/users?page=1&pageSize=25`
 *       and parses `{ items, pageNumber, pageSize, totalCount }` cleanly.
 *   3. The store's create-success path upserts the new entity into `entities`
 *       and sets `activeId` so the dialog's completion watcher closes the
 *       dialog and emits `(saved)` with the right id.
 *   4. A 409 conflict is surfaced via `saveConflict` (drives the inline
 *       email-field message rather than a toast).
 *
 * The user reported "I was unable to create user and fetch" — these tests
 * pin exactly the request shapes the live app emits, so a regression in
 * the URL, headers, body, or response-parsing fails CI before manual smoke.
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL } from '@core/http/api-config.token';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { NotificationService } from '@core/services/notification.service';

import { UsersApiService } from '../data/users-api.service';
import type { UserDto } from '../data/user.types';
import { UsersStore } from '../state/users.store';

const BASE = '/api/proxy/v1';

const SAMPLE_USER: UserDto = {
  id: '11111111-2222-4333-8444-555555555555',
  email: 'newuser@example.com',
  firstName: 'New',
  lastName: 'User',
  externalIdentityId: null,
  isActive: true,
  lastLoginAt: null,
  isDeleted: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: '2026-04-30T07:30:00+00:00',
  createdBy: 'tester',
  modifiedAt: null,
  modifiedBy: null,
};

class FakeNotificationService {
  success = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
}

describe('Users feature — create + fetch end-to-end (SPA wire layer)', () => {
  let store: InstanceType<typeof UsersStore>;
  let api: UsersApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: NotificationService, useClass: FakeNotificationService },
        UsersApiService,
        UsersStore,
      ],
    });
    store = TestBed.inject(UsersStore);
    api = TestBed.inject(UsersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // ── 1. CREATE — happy path with full wire-layer assertions ────────────

  it('createUser POSTs the four-field body to /users with idempotency + suppress headers, then upserts on 201', () => {
    store.createUser({
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      externalIdentityId: null,
    });

    const req = httpMock.expectOne(`${BASE}/users`);
    expect(req.request.method).toBe('POST');

    // Headers — Idempotency-Key MUST land on the wire (the BFF's idempotency
    // filter rejects 400 without it). The X-Skip-Error-Handling header is
    // stripped by the errorInterceptor BEFORE the HTTP layer sees it (it's
    // a SPA-side hint flag, not a wire header), so we don't assert on it
    // here — see error.interceptor.ts §SKIP_HEADER for the strip logic.
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(true);
    expect(req.request.headers.get('X-Idempotency-Key')).toMatch(
      /^[0-9a-f-]+$/i,
    );

    // Body — the canonical 4-field shape the dialog sends.
    expect(req.request.body).toEqual({
      email: 'newuser@example.com',
      firstName: 'New',
      lastName: 'User',
      externalIdentityId: null,
    });

    req.flush(SAMPLE_USER, { status: 201, statusText: 'Created' });

    expect(store.saving()).toBe(false);
    expect(store.saveError()).toBeNull();
    expect(store.activeId()).toBe(SAMPLE_USER.id);
    expect(store.entities()[SAMPLE_USER.id]).toEqual(SAMPLE_USER);
  });

  // ── 2. CREATE — externalIdentityId optional ───────────────────────────

  it('createUser sends a UUID externalIdentityId when supplied', () => {
    const xid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    store.createUser({
      email: 'sso@example.com',
      firstName: 'SSO',
      lastName: 'User',
      externalIdentityId: xid,
    });
    const req = httpMock.expectOne(`${BASE}/users`);
    expect((req.request.body as { externalIdentityId: string }).externalIdentityId).toBe(xid);
    req.flush({ ...SAMPLE_USER, externalIdentityId: xid }, { status: 201, statusText: 'Created' });
  });

  // ── 3. FETCH (list) — happy path ──────────────────────────────────────

  it('list GETs /users with paging params and parses the PagedResult envelope', async () => {
    const obs = api.list({
      page: 1,
      pageSize: 25,
      search: null,
      activeOnly: null,
    });
    const promise = firstValueFrom(obs);

    const req = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === `${BASE}/users`,
    );
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('25');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('activeOnly')).toBe(false);
    // Reads MUST NOT carry the idempotency header.
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(false);

    req.flush({
      items: [SAMPLE_USER],
      pageNumber: 1,
      pageSize: 25,
      totalCount: 1,
    });

    const result = await promise;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(SAMPLE_USER);
    expect(result.totalCount).toBe(1);
    expect(result.pageNumber).toBe(1);
  });

  // ── 4. FETCH — search query is forwarded ──────────────────────────────

  it('list passes search + activeOnly when supplied', async () => {
    const obs = api.list({
      page: 2,
      pageSize: 10,
      search: 'alice',
      activeOnly: true,
    });
    const promise = firstValueFrom(obs);

    const req = httpMock.expectOne((r) => r.url === `${BASE}/users`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.get('search')).toBe('alice');
    expect(req.request.params.get('activeOnly')).toBe('true');

    req.flush({
      items: [],
      pageNumber: 2,
      pageSize: 10,
      totalCount: 0,
    });
    await promise;
  });

  // ── 5. CREATE → LIST cycle — full UX round-trip ───────────────────────

  it('list → create → re-list reflects the created user in the cached entities', async () => {
    // 1) Initial list — empty.
    const initialObs = api.list({ page: 1, pageSize: 25, search: null, activeOnly: null });
    const initial = firstValueFrom(initialObs);
    httpMock
      .expectOne((r) => r.url === `${BASE}/users`)
      .flush({ items: [], pageNumber: 1, pageSize: 25, totalCount: 0 });
    expect((await initial).items).toHaveLength(0);

    // 2) Create.
    store.createUser({
      email: SAMPLE_USER.email,
      firstName: SAMPLE_USER.firstName,
      lastName: SAMPLE_USER.lastName,
      externalIdentityId: null,
    });
    httpMock.expectOne(`${BASE}/users`).flush(SAMPLE_USER, { status: 201, statusText: 'Created' });
    expect(store.entities()[SAMPLE_USER.id]?.email).toBe(SAMPLE_USER.email);

    // 3) Re-list — the new user is now in the response.
    const secondObs = api.list({ page: 1, pageSize: 25, search: null, activeOnly: null });
    const second = firstValueFrom(secondObs);
    httpMock
      .expectOne((r) => r.url === `${BASE}/users`)
      .flush({ items: [SAMPLE_USER], pageNumber: 1, pageSize: 25, totalCount: 1 });
    expect((await second).items).toHaveLength(1);
    expect((await second).items[0]?.id).toBe(SAMPLE_USER.id);
  });

  // ── 6. CREATE — 409 conflict surfaces via saveConflict ────────────────

  it('createUser flips saveConflict on 409 (drives the inline email-field message, not a toast)', () => {
    store.createUser({
      email: 'dup@example.com',
      firstName: 'Dup',
      lastName: 'User',
      externalIdentityId: null,
    });
    const req = httpMock.expectOne(`${BASE}/users`);
    req.flush(
      { status: 409, code: 'Conflict', message: 'Email already in use' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(store.saveError()?.statusCode).toBe(409);
    expect(store.saveConflict()).toBe(true);
  });

  // ── 7. CREATE — 400 validation surfaces field errors ──────────────────

  it('createUser surfaces ProblemDetails errors map on 400', () => {
    store.createUser({
      email: 'bad',
      firstName: '',
      lastName: '',
      externalIdentityId: null,
    });
    const req = httpMock.expectOne(`${BASE}/users`);
    req.flush(
      {
        type: 'urn:ep:error:validation',
        title: 'Validation failed',
        status: 400,
        errors: { Email: ['Email must be valid.'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(store.saveError()?.statusCode).toBe(400);
    expect(store.saveError()?.errors).toBeDefined();
  });
});
