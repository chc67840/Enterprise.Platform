/**
 * ─── withSearch() ───────────────────────────────────────────────────────────────
 *
 * Search / sort / filter state — what the user has asked for in the current
 * view. Kept separate from data (ids/entities) so navigating away + back can
 * restore the exact same view (search term, sort column, filter chips) when
 * the store is route-scoped.
 *
 * WHAT IT ADDS
 *   State:   queryParams (QueryParams shape — see @core/models)
 *   Computed: searchQuery, activeFilters (convenience signals for templates)
 *   Methods: setSearchQuery, setSortConfig, setFilter, removeFilter,
 *            clearFilters, setQueryPage, setQueryPageSize
 *
 * WHY DUPLICATE page/pageSize WITH withPagination?
 *   Intentional. `withPagination` holds the server's last-known
 *   page/pageSize/total for display (hasNext/hasPrev depend on them);
 *   `withSearch.queryParams` holds the UI's current request intent. They
 *   briefly diverge while a fetch is in flight — which is what the user
 *   sees in the UI.
 *
 *   `setQueryPage` / `setQueryPageSize` exist so callers can update the
 *   intent without polluting it with server-authoritative fields like `total`.
 */
import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

import { DEFAULT_QUERY_PARAMS, type QueryParams, type SortConfig } from '@core/models';

export interface SearchState {
  /** Complete query-parameter object. Sent verbatim to `api.getAll`. */
  readonly queryParams: QueryParams;
}

export function withSearch() {
  return signalStoreFeature(
    withState<SearchState>({ queryParams: DEFAULT_QUERY_PARAMS }),
    withComputed((store) => ({
      /** Convenience — `queryParams.query` surfaced directly. */
      searchQuery: computed(() => store.queryParams().query ?? ''),

      /**
       * Counts active filters for UI badges ("3 filters applied"). Treats
       * empty strings / null / undefined as "not active".
       */
      activeFilters: computed(() => {
        const f = store.queryParams().filters ?? {};
        return Object.values(f).filter((v) => v !== null && v !== undefined && v !== '').length;
      }),
    })),
    withMethods((store) => ({
      /** Sets the free-text search term. Resets to page 1 (new results set). */
      setSearchQuery: (query: string) =>
        patchState(store, {
          queryParams: { ...store.queryParams(), query, page: 1 },
        }),

      /** Updates sort. Does not reset page — sort within the current page is common UX. */
      setSortConfig: (sort: SortConfig | undefined) =>
        patchState(store, {
          queryParams: { ...store.queryParams(), sort },
        }),

      /** Sets / replaces a single filter key. Resets page to 1. */
      setFilter: (key: string, value: unknown) =>
        patchState(store, {
          queryParams: {
            ...store.queryParams(),
            filters: { ...(store.queryParams().filters ?? {}), [key]: value },
            page: 1,
          },
        }),

      /** Removes one filter by key. Resets page to 1. */
      removeFilter: (key: string) => {
        const { [key]: _removed, ...rest } = (store.queryParams().filters ?? {}) as Record<string, unknown>;
        patchState(store, {
          queryParams: { ...store.queryParams(), filters: rest, page: 1 },
        });
      },

      /** Clears every filter. Resets page to 1. */
      clearFilters: () =>
        patchState(store, {
          queryParams: { ...store.queryParams(), filters: {}, page: 1 },
        }),

      /** Updates the query's page index without touching pagination state. */
      setQueryPage: (page: number) =>
        patchState(store, {
          queryParams: { ...store.queryParams(), page },
        }),

      /** Updates the query's page size without touching pagination state. */
      setQueryPageSize: (pageSize: number) =>
        patchState(store, {
          queryParams: { ...store.queryParams(), pageSize, page: 1 },
        }),
    })),
  );
}
