/**
 * ─── Store features — UNIT TESTS ────────────────────────────────────────────────
 *
 * One spec file for all four composable features
 * (loading / pagination / search / selection). Testing in composition mirrors
 * how they ship — `createEntityStore` wires them together. Each feature's
 * contract is narrow enough that separate files would duplicate boilerplate
 * without improving diagnosis clarity.
 */
import { TestBed } from '@angular/core/testing';
import { signalStore, withState } from '@ngrx/signals';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  withLoadingState,
  withPagination,
  withSearch,
  withSelection,
} from './index';

/**
 * Minimal composite store that layers every feature on top of an empty state
 * so we can poke each feature's signals + methods in isolation without the
 * createEntityStore CRUD layer's HTTP mocking noise.
 */
const CompositeStore = signalStore(
  { providedIn: 'root' },
  withState({}),
  withLoadingState(),
  withPagination(25),
  withSearch(),
  withSelection(),
);
type CompositeStore = InstanceType<typeof CompositeStore>;

describe('withLoadingState', () => {
  let store: CompositeStore;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CompositeStore);
  });

  it('exposes the five async signals with initial values', () => {
    expect(store.loading()).toBe(false);
    expect(store.loadingDetail()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.deleting()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('setLoading clears prior errors', () => {
    store.setError({ message: 'prev', statusCode: 500 });
    store.setLoading(true);
    expect(store.loading()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('setLoaded clears every flag + error in one call', () => {
    store.setLoading(true);
    store.setSaving(true);
    store.setError({ message: 'err', statusCode: 500 });

    store.setLoaded();
    expect(store.loading()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('clearError drops only the error', () => {
    // NOTE: `setError` intentionally zeros the async flags (see impl). The
    // `clearError` method is specifically the error-only clear — not the
    // whole-state reset.
    store.setError({ message: 'e', statusCode: 500 });
    expect(store.error()).not.toBeNull();
    store.clearError();
    expect(store.error()).toBeNull();
  });
});

describe('withPagination', () => {
  let store: CompositeStore;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CompositeStore);
  });

  it('starts at page 1 with the configured default page size', () => {
    expect(store.page()).toBe(1);
    expect(store.pageSize()).toBe(25);
    expect(store.total()).toBe(0);
    expect(store.hasNext()).toBe(false);
    expect(store.hasPrev()).toBe(false);
  });

  it('setPageSize resets page to 1', () => {
    store.setPage(7);
    store.setPageSize(50);
    expect(store.pageSize()).toBe(50);
    expect(store.page()).toBe(1);
  });

  it('hasNext / hasPrev flip based on page vs totalPages', () => {
    store.setPaginationFromResponse({ page: 2, pageSize: 25, total: 75, totalPages: 3 });
    expect(store.hasNext()).toBe(true);
    expect(store.hasPrev()).toBe(true);

    store.setPaginationFromResponse({ page: 3, pageSize: 25, total: 75, totalPages: 3 });
    expect(store.hasNext()).toBe(false);

    store.setPaginationFromResponse({ page: 1, pageSize: 25, total: 75, totalPages: 3 });
    expect(store.hasPrev()).toBe(false);
  });
});

describe('withSearch', () => {
  let store: CompositeStore;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CompositeStore);
  });

  it('setSearchQuery patches query + resets page to 1', () => {
    store.setQueryPage(5);
    store.setSearchQuery('alice');
    expect(store.searchQuery()).toBe('alice');
    expect(store.queryParams().page).toBe(1);
  });

  it('setSortConfig updates sort without touching page', () => {
    store.setQueryPage(3);
    store.setSortConfig({ field: 'createdAt', direction: 'desc' });
    expect(store.queryParams().sort).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(store.queryParams().page).toBe(3);
  });

  it('setFilter / removeFilter / clearFilters maintain filter map + reset page to 1', () => {
    store.setFilter('status', 'active');
    store.setFilter('role', 'admin');
    expect(store.queryParams().filters).toEqual({ status: 'active', role: 'admin' });
    expect(store.queryParams().page).toBe(1);
    expect(store.activeFilters()).toBe(2);

    store.removeFilter('role');
    expect(store.queryParams().filters).toEqual({ status: 'active' });
    expect(store.activeFilters()).toBe(1);

    store.clearFilters();
    expect(store.queryParams().filters).toEqual({});
    expect(store.activeFilters()).toBe(0);
  });

  it('activeFilters ignores empty / null / undefined values', () => {
    store.setFilter('a', '');
    store.setFilter('b', null);
    store.setFilter('c', undefined);
    store.setFilter('d', 'real');
    expect(store.activeFilters()).toBe(1);
  });
});

describe('withSelection', () => {
  let store: CompositeStore;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CompositeStore);
  });

  it('select / deselect / toggle preserve order + idempotency', () => {
    store.select('a');
    store.select('b');
    store.select('a'); // duplicate — no-op
    expect(store.selectedIds()).toEqual(['a', 'b']);
    expect(store.hasSelection()).toBe(true);
    expect(store.selectionCount()).toBe(2);

    store.deselect('a');
    expect(store.selectedIds()).toEqual(['b']);

    store.toggle('c');
    expect(store.selectedIds()).toEqual(['b', 'c']);
    store.toggle('b');
    expect(store.selectedIds()).toEqual(['c']);
  });

  it('selectAll replaces selection atomically; clearSelection empties it', () => {
    store.select('a');
    store.selectAll(['x', 'y', 'z']);
    expect(store.selectedIds()).toEqual(['x', 'y', 'z']);

    store.clearSelection();
    expect(store.selectedIds()).toEqual([]);
    expect(store.hasSelection()).toBe(false);
  });
});
