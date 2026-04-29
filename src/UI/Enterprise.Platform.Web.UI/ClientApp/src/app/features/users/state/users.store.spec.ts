/**
 * ─── UsersStore — UNIT TESTS ────────────────────────────────────────────────────
 *
 * Covers the production-critical edge cases:
 *   - 404 on `loadById` flips `notFound` (without setting `detailError`)
 *   - 5xx on `loadById` flips `detailError` (without setting `notFound`)
 *   - 409 on `createUser` flips `saveConflict` and exposes the raw error
 *   - `loadList` 5xx flips `listError` and clears `loading`
 *   - `hasNoMatches` only fires when filters are applied AND result is empty
 *   - `clearSaveError` resets the channel
 *   - `fieldErrorMessage` resolves both lower- and Title-cased keys
 */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL } from '@core/http/api-config.token';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { NotificationService } from '@core/services/notification.service';

import { UsersApiService } from '../data/users-api.service';
import type { ApiError } from '@core/models';
import type { UserDto } from '../data/user.types';
import { fieldErrorMessage, UsersStore } from './users.store';

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

/**
 * Stub that records calls without depending on the real
 * `MessageService` — store unit tests don't need a live PrimeNG ToastModule.
 */
class FakeNotificationService {
  success = vi.fn();
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
}

describe('UsersStore', () => {
  let store: InstanceType<typeof UsersStore>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Include the real error interceptor so HttpErrorResponse → ApiError
        // normalization matches production. Without this, `error.statusCode`
        // is undefined on the rejected branch and the store can't route 404
        // vs 500 vs 409 correctly.
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        // The error interceptor injects Router; provide a dummy.
        provideRouter([]),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: NotificationService, useClass: FakeNotificationService },
        UsersApiService,
        UsersStore,
      ],
    });
    store = TestBed.inject(UsersStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('loadById flips notFound on 404 (and leaves detailError null)', () => {
    store.loadById('missing');
    const req = httpMock.expectOne(`${BASE}/users/missing`);
    req.flush({ status: 404, code: 'NotFound', message: 'No such user' }, { status: 404, statusText: 'Not Found' });

    expect(store.notFound()).toBe(true);
    expect(store.detailError()).toBeNull();
    expect(store.loadingDetail()).toBe(false);
  });

  it('loadById sets detailError on 500 (and leaves notFound false)', () => {
    store.loadById(sampleUser.id);
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}`);
    req.flush('boom', { status: 500, statusText: 'Internal Server Error' });

    expect(store.notFound()).toBe(false);
    expect(store.detailError()).not.toBeNull();
    expect(store.loadingDetail()).toBe(false);
  });

  it('loadById success caches the entity and sets activeId', () => {
    store.loadById(sampleUser.id);
    const req = httpMock.expectOne(`${BASE}/users/${sampleUser.id}`);
    req.flush(sampleUser);

    expect(store.entities()[sampleUser.id]).toEqual(sampleUser);
    expect(store.activeId()).toBe(sampleUser.id);
    expect(store.notFound()).toBe(false);
    expect(store.detailError()).toBeNull();
  });

  it('createUser surfaces 409 via saveConflict and saveError', () => {
    store.createUser({
      email: 'dup@example.test',
      firstName: 'Dup',
      lastName: 'Licate',
      externalIdentityId: null,
    });
    const req = httpMock.expectOne(`${BASE}/users`);
    req.flush(
      { status: 409, code: 'Conflict', message: 'Email already in use' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(store.saveConflict()).toBe(true);
    expect(store.saveError()).not.toBeNull();
    expect(store.saving()).toBe(false);
  });

  it('clearSaveError resets the channel', () => {
    store.createUser({
      email: 'dup@example.test',
      firstName: 'Dup',
      lastName: 'Licate',
      externalIdentityId: null,
    });
    httpMock.expectOne(`${BASE}/users`).flush(
      { status: 409, code: 'Conflict', message: 'Email already in use' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(store.saveError()).not.toBeNull();
    store.clearSaveError();
    expect(store.saveError()).toBeNull();
    expect(store.saveConflict()).toBe(false);
  });

  it('loadList 5xx flips listError and clears loading', () => {
    store.loadList();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/users`);
    req.flush('boom', { status: 503, statusText: 'Service Unavailable' });

    expect(store.listError()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('hasNoMatches stays false when filters are unset', () => {
    store.loadList();
    httpMock.expectOne((r) => r.url === `${BASE}/users`).flush({
      items: [],
      pageNumber: 1,
      pageSize: 25,
      totalCount: 0,
    });

    expect(store.isEmpty()).toBe(true);
    expect(store.hasNoMatches()).toBe(false);   // no filters applied
  });

  it('hasNoMatches fires when filters are applied AND result is empty', () => {
    store.loadList({ search: 'nobody' });
    httpMock.expectOne((r) => r.url === `${BASE}/users`).flush({
      items: [],
      pageNumber: 1,
      pageSize: 25,
      totalCount: 0,
    });

    expect(store.hasNoMatches()).toBe(true);
  });

  describe('fieldErrorMessage', () => {
    it('resolves lowercase keys', () => {
      const err: ApiError = {
        message: 'Validation failed',
        statusCode: 400,
        errors: { email: ['Email is invalid'] },
      };
      expect(fieldErrorMessage(err, 'email')).toBe('Email is invalid');
    });

    it('falls back to Title-cased keys (backend ProblemDetails convention)', () => {
      const err: ApiError = {
        message: 'Validation failed',
        statusCode: 400,
        errors: { Email: ['Email is required'] },
      };
      expect(fieldErrorMessage(err, 'email')).toBe('Email is required');
    });

    it('returns null for unknown fields and null error', () => {
      expect(fieldErrorMessage(null, 'email')).toBeNull();
      expect(fieldErrorMessage({ message: 'x', statusCode: 400 }, 'email')).toBeNull();
    });
  });
});
