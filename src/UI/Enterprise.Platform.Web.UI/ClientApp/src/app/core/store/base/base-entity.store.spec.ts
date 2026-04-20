/**
 * ─── createEntityStore — UNIT TESTS ─────────────────────────────────────────────
 *
 * Covers the factory's observable contract:
 *   - loadAll success patches ids/entities/pagination/lastLoadedAt/isStale.
 *   - loadAll error patches `error` but preserves ids/entities.
 *   - loadById merges into ids + entities and sets activeId.
 *   - createEntity prepends + increments total + marks stale.
 *   - updateEntity optimistic-patch + 409 rollback.
 *   - deleteEntity prunes from ids + entities + selection + activeId.
 *   - invalidate flips isStale = true.
 *
 * We avoid wiring the success-toast `NotificationService` to a real
 * MessageService — the notifier is injected only when
 * `showNotifications: true`; the tests disable it via
 * `showNotifications: false` so the spec isolates store behaviour from
 * PrimeNG setup.
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL } from '@core/http/api-config.token';
import { BaseApiService } from '@core/http/base-api.service';
import type { BaseEntity } from '@core/models';

import { createEntityStore } from './base-entity.store';

interface Widget extends BaseEntity {
  readonly name: string;
}

@Injectable({ providedIn: 'root' })
class WidgetApiService extends BaseApiService<Widget> {
  protected override readonly endpoint = 'widgets';
}

const WidgetStore = createEntityStore<Widget>({
  serviceType: WidgetApiService,
  entityName: 'Widget',
  providedIn: 'root',
  defaultPageSize: 10,
  showNotifications: false,
  cacheTtlMs: 60_000,
});
type WidgetStore = InstanceType<typeof WidgetStore>;

const BASE = 'https://example.test/api/v1';

describe('createEntityStore', () => {
  let store: WidgetStore;
  let httpMock: HttpTestingController;

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

    store = TestBed.inject(WidgetStore);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty + stale (forces initial load)', () => {
    expect(store.ids()).toEqual([]);
    expect(Object.keys(store.entities())).toEqual([]);
    expect(store.isStale()).toBe(true);
    expect(store.lastLoadedAt()).toBe(0);
    expect(store.isEmpty()).toBe(true);
    expect(store.entityCount()).toBe(0);
  });

  it('loadAll success patches ids + entities + pagination + lastLoadedAt', () => {
    store.loadAll();
    // `withSearch` seeds `queryParams` from DEFAULT_QUERY_PARAMS (pageSize=20)
    // — `defaultPageSize` on the factory only feeds `withPagination`'s display
    // state, not the query shape. This divergence is intentional and
    // harmonises after the first response via `setPaginationFromResponse`.
    const req = httpMock.expectOne(`${BASE}/widgets?page=1&pageSize=20`);
    req.flush({
      data: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    expect(store.ids()).toEqual(['a', 'b']);
    expect(store.entities()).toEqual({
      a: { id: 'a', name: 'Alpha' },
      b: { id: 'b', name: 'Beta' },
    });
    expect(store.total()).toBe(2);
    expect(store.isStale()).toBe(false);
    expect(store.lastLoadedAt()).toBeGreaterThan(0);
    expect(store.isEmpty()).toBe(false);
    expect(store.entityCount()).toBe(2);
    expect(store.allEntities()).toEqual([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]);
  });

  it('loadAll error preserves existing data + captures error', () => {
    // Seed with a successful load so we can verify preservation on failure.
    store.loadAll();
    httpMock.expectOne(() => true).flush({
      data: [{ id: 'a', name: 'Alpha' }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });

    store.loadAll();
    httpMock
      .expectOne(() => true)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(store.ids()).toEqual(['a']);
    expect(store.error()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('loadById merges into ids + entities and sets activeId', () => {
    store.loadById('x');
    httpMock
      .expectOne(`${BASE}/widgets/x`)
      .flush({ data: { id: 'x', name: 'X' } });

    expect(store.ids()).toEqual(['x']);
    expect(store.entities()).toEqual({ x: { id: 'x', name: 'X' } });
    expect(store.activeId()).toBe('x');
    expect(store.activeEntity()).toEqual({ id: 'x', name: 'X' });
  });

  it('createEntity prepends to ids, increments total, marks stale', () => {
    store.loadAll();
    httpMock.expectOne(() => true).flush({
      data: [{ id: 'a', name: 'A' }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });

    store.createEntity({ name: 'New' });
    httpMock.expectOne(`${BASE}/widgets`).flush({ data: { id: 'new', name: 'New' } });

    expect(store.ids()).toEqual(['new', 'a']);
    expect(store.total()).toBe(2);
    expect(store.isStale()).toBe(true); // next list view will refetch for server ordering
  });

  it('updateEntity rolls back on 409 Conflict (optimistic-concurrency)', () => {
    store.loadById('x');
    httpMock
      .expectOne(`${BASE}/widgets/x`)
      .flush({ data: { id: 'x', name: 'Original', version: 'v1' } });

    store.updateEntity({ id: 'x', changes: { name: 'Attempted', version: 'v1' } });
    // Optimistic patch visible immediately:
    expect(store.entities()['x']!.name).toBe('Attempted');

    // Server rejects with 409.
    httpMock.expectOne((r) => r.method === 'PUT' && r.url === `${BASE}/widgets/x`).flush(
      { message: 'conflict' },
      { status: 409, statusText: 'Conflict' },
    );

    // Snapshot restored — no drift.
    expect(store.entities()['x']!.name).toBe('Original');
    expect(store.error()).not.toBeNull();
    expect(store.saving()).toBe(false);
  });

  it('deleteEntity prunes ids, entities, selection, and resets activeId', () => {
    store.loadById('x');
    httpMock.expectOne(() => true).flush({ data: { id: 'x', name: 'X' } });
    store.select('x');
    store.setActive('x');

    store.deleteEntity('x');
    httpMock.expectOne((r) => r.method === 'DELETE').flush(null);

    expect(store.ids()).toEqual([]);
    expect(store.entities()).toEqual({});
    expect(store.selectedIds()).toEqual([]);
    expect(store.activeId()).toBeNull();
    expect(store.isStale()).toBe(true);
  });

  it('invalidate flips isStale to true', () => {
    store.loadAll();
    httpMock.expectOne(() => true).flush({
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });
    expect(store.isStale()).toBe(false);

    store.invalidate();
    expect(store.isStale()).toBe(true);
  });
});
