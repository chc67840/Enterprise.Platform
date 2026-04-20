/**
 * ─── withLoadingState() ─────────────────────────────────────────────────────────
 *
 * A reusable NGRX Signals feature that adds async-status signals + their
 * setters to any store. Composed into `createEntityStore` but usable in any
 * custom signal store.
 *
 * WHY SEPARATE
 *   Every store that talks to a server has the same five async bits:
 *   - loading (list fetch)
 *   - loadingDetail (single-record fetch — distinct so details can stream in
 *     while a list is also loading)
 *   - saving (create/update/patch)
 *   - deleting (delete)
 *   - error (last failure; cleared on next successful operation)
 *
 *   Packaging them as a `signalStoreFeature` avoids per-feature boilerplate
 *   and gives templates a predictable API.
 *
 * WHAT IT ADDS
 *   State signals: loading, loadingDetail, saving, deleting, error
 *   Methods:       setLoading, setLoadingDetail, setSaving, setDeleting,
 *                  setLoaded (clears loading+error in one call), setError,
 *                  clearError
 */
import { patchState, signalStoreFeature, withMethods, withState } from '@ngrx/signals';

import type { ApiError } from '@core/models';

export interface LoadingState {
  /** List-fetch in progress. */
  readonly loading: boolean;
  /** Detail-fetch in progress — distinct so detail can update while list loads. */
  readonly loadingDetail: boolean;
  /** Create/update/patch in progress. */
  readonly saving: boolean;
  /** Delete in progress. */
  readonly deleting: boolean;
  /** Last failure — cleared on next successful operation. */
  readonly error: ApiError | null;
}

const INITIAL: LoadingState = {
  loading: false,
  loadingDetail: false,
  saving: false,
  deleting: false,
  error: null,
};

export function withLoadingState() {
  return signalStoreFeature(
    withState<LoadingState>(INITIAL),
    withMethods((store) => ({
      setLoading: (loading: boolean) => patchState(store, { loading, error: null }),
      setLoadingDetail: (loadingDetail: boolean) => patchState(store, { loadingDetail, error: null }),
      setSaving: (saving: boolean) => patchState(store, { saving, error: null }),
      setDeleting: (deleting: boolean) => patchState(store, { deleting, error: null }),
      setLoaded: () => patchState(store, { loading: false, loadingDetail: false, saving: false, deleting: false, error: null }),
      setError: (error: ApiError) => patchState(store, { loading: false, loadingDetail: false, saving: false, deleting: false, error }),
      clearError: () => patchState(store, { error: null }),
    })),
  );
}
