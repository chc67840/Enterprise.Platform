/**
 * ─── BaseApiService — UNIT TESTS ────────────────────────────────────────────────
 *
 * Proves:
 *   - URL composition: `${baseUrl}/${endpoint}` and `/:id` with encoding.
 *   - `buildParams` serialization for pagination, sort, search, and filters
 *     including special-char encoding on the wire.
 *   - `If-Match` header attached on update / patch when version is present.
 *   - `bulkDelete` POSTs to `/bulk-delete` with `{ ids }`.
 *   - Filter values that are empty / null / undefined are dropped.
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
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { API_BASE_URL } from './api-config.token';
import { BaseApiService } from './base-api.service';
import type { BaseEntity } from '@core/models';

interface TestEntity extends BaseEntity {
  readonly name: string;
}

@Injectable()
class TestApiService extends BaseApiService<TestEntity> {
  protected override readonly endpoint = 'things';
}

const BASE = 'https://example.test/api/v1';

describe('BaseApiService', () => {
  let api: TestApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        TestApiService,
      ],
    });
    api = TestBed.inject(TestApiService);
    httpMock = TestBed.inject(HttpTestingController);
    // Ensure HttpClient is eagerly resolved too.
    TestBed.inject(HttpClient);
  });

  it('getById encodes the id in the URL', () => {
    api.getById('id with spaces & chars').subscribe();
    httpMock.expectOne(`${BASE}/things/id%20with%20spaces%20%26%20chars`).flush({});
  });

  it('getAll serializes pagination + search + sort + filters', () => {
    api.getAll({
      page: 2,
      pageSize: 50,
      query: 'alice',
      sort: { field: 'createdAt', direction: 'desc' },
      filters: { status: 'active', createdAfter: '2026-01-01' },
    }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE}/things`);
    const params = req.request.params;
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('q')).toBe('alice');
    expect(params.get('sortBy')).toBe('createdAt');
    expect(params.get('sortDir')).toBe('desc');
    expect(params.get('status')).toBe('active');
    expect(params.get('createdAfter')).toBe('2026-01-01');
    req.flush({ data: [], page: 1, pageSize: 50, total: 0, totalPages: 0 });
  });

  it('getAll drops undefined / null / empty-string filters', () => {
    api.getAll({
      page: 1,
      pageSize: 20,
      filters: { status: '', flag: null as unknown as string, missing: undefined },
    }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE}/things`);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('flag')).toBe(false);
    expect(req.request.params.has('missing')).toBe(false);
    req.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('getAll forwards no params when called with undefined', () => {
    api.getAll().subscribe();
    const req = httpMock.expectOne(`${BASE}/things`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('create POSTs to the endpoint URL with the entity body', () => {
    api.create({ name: 'n' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/things`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'n' });
    req.flush({ data: { id: '1', name: 'n' } });
  });

  it('update PUTs with an If-Match header when version is present', () => {
    api.update('42', { name: 'renamed', version: 'W/"abc"' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/things/42`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('"W/"abc""');
    req.flush({ data: { id: '42', name: 'renamed' } });
  });

  it('update omits If-Match when version is absent', () => {
    api.update('42', { name: 'renamed' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/things/42`);
    expect(req.request.headers.has('If-Match')).toBe(false);
    req.flush({ data: { id: '42', name: 'renamed' } });
  });

  it('patch attaches If-Match identically to update', () => {
    api.patch('42', { name: 'p', version: 'v1' }).subscribe();
    const req = httpMock.expectOne(`${BASE}/things/42`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('"v1"');
    req.flush({ data: { id: '42', name: 'p' } });
  });

  it('delete DELETEs the /:id URL', () => {
    api.delete('42').subscribe();
    const req = httpMock.expectOne(`${BASE}/things/42`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('bulkDelete POSTs to /bulk-delete with { ids }', () => {
    api.bulkDelete(['a', 'b', 'c']).subscribe();
    const req = httpMock.expectOne(`${BASE}/things/bulk-delete`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ids: ['a', 'b', 'c'] });
    req.flush(null);
  });
});
