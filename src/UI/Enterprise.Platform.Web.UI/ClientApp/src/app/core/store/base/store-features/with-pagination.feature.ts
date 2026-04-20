/**
 * ─── withPagination(defaultPageSize) ────────────────────────────────────────────
 *
 * Pagination slice — page/pageSize/total + derived has-next/has-prev signals.
 *
 * WHY COMPUTED RATHER THAN STATE
 *   `hasNext` / `hasPrev` / `totalPages` are derivations — storing them in
 *   state would let them drift. Angular `computed()` guarantees they're
 *   always current and skips recomputation when the inputs are unchanged.
 *
 * WHAT'S SOURCE-OF-TRUTH
 *   - `page` / `pageSize` are user-driven intents (what the UI asked for).
 *   - `total` comes from the server's `PagedResponse.total`.
 *   - `setPaginationFromResponse` writes all four (page/pageSize/total/
 *     totalPages) in one atomic patch — matches the response shape 1:1.
 */
import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export interface PaginationState {
  /** 1-based page index the UI is currently displaying. */
  readonly page: number;
  /** Page size — may change via pageSize selector. */
  readonly pageSize: number;
  /** Total row count (from server). `0` means not loaded yet. */
  readonly total: number;
  /** `Math.ceil(total / pageSize)`; `0` when no data. */
  readonly totalPages: number;
}

export function withPagination(defaultPageSize: number) {
  return signalStoreFeature(
    withState<PaginationState>({
      page: 1,
      pageSize: defaultPageSize,
      total: 0,
      totalPages: 0,
    }),
    withComputed((store) => ({
      /** True when `page < totalPages`. */
      hasNext: computed(() => store.page() < store.totalPages()),
      /** True when `page > 1`. */
      hasPrev: computed(() => store.page() > 1),
    })),
    withMethods((store) => ({
      /** Updates the current page. Does NOT refetch — the store's `loadAll` does. */
      setPage: (page: number) => patchState(store, { page }),

      /**
       * Updates page size. Resets `page` to 1 so the user doesn't end up on
       * page 7 of a page-size-5 list after bumping page size to 50.
       */
      setPageSize: (pageSize: number) => patchState(store, { pageSize, page: 1 }),

      /**
       * Writes pagination state from a server response envelope. Called by
       * `createEntityStore.loadAll` inside `tapResponse.next`.
       */
      setPaginationFromResponse: (resp: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      }) =>
        patchState(store, {
          page: resp.page,
          pageSize: resp.pageSize,
          total: resp.total,
          totalPages: resp.totalPages,
        }),
    })),
  );
}
