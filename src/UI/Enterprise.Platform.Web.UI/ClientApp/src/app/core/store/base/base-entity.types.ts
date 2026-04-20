/**
 * ─── BASE ENTITY STATE SHAPE ────────────────────────────────────────────────────
 *
 * WHY
 *   Every feature store normalizes its entity list the same way:
 *     - `ids: string[]`       — preserves server-ordered sequence
 *     - `entities: Record<id, T>` — O(1) lookup for detail views
 *
 *   Plus pagination, query params, async markers, and cache markers. Pinning
 *   the shape here keeps `createEntityStore<T>` consistent across features
 *   and gives reviewers one place to read when evaluating "what does a store
 *   know?".
 *
 * STATE SECTIONS
 *   - data               — ids + entities dict + activeId (selected row for detail)
 *   - cache              — lastLoadedAt + isStale so `loadAllIfStale` can short-circuit
 *   - loading / error    — contributed by `withLoadingState()`
 *   - pagination         — contributed by `withPagination()`
 *   - search/sort/filter — contributed by `withSearch()`
 *   - selection          — contributed by `withSelection()`
 *
 *   Only the first section is declared here — the others come from their
 *   respective `signalStoreFeature`s (see `store-features/`).
 *
 * CACHE TTL
 *   Default 5 minutes matches the backend `IMemoryCache` defaults on most
 *   reference endpoints. Features that want a different TTL set it via
 *   `createEntityStore({ cacheTtlMs: 60_000 })`.
 */
import type { BaseEntity } from '@core/models';

/** Default TTL — 5 minutes. Feature stores override via `EntityStoreConfig`. */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export interface EntityDataState<T extends BaseEntity> {
  /** Server-ordered ids. Iterate this to render lists — not `Object.keys(entities)`. */
  readonly ids: readonly string[];

  /** Normalised dictionary keyed by `id`. Enables O(1) detail lookup. */
  readonly entities: Readonly<Record<string, T>>;

  /** Currently-selected entity for detail views. `null` when nothing active. */
  readonly activeId: string | null;

  /**
   * Epoch ms of the last successful `loadAll`. `0` means never loaded.
   * Consulted by `loadAllIfStale()` to decide whether to refetch.
   */
  readonly lastLoadedAt: number;

  /**
   * `true` when a mutation has invalidated the data set. `loadAllIfStale()`
   * refetches when this is `true`, regardless of TTL.
   */
  readonly isStale: boolean;
}

/** Factory for the initial shape. `isStale: true` forces an initial load. */
export function createInitialEntityState<T extends BaseEntity>(): EntityDataState<T> {
  return {
    ids: [],
    entities: {},
    activeId: null,
    lastLoadedAt: 0,
    isStale: true,
  };
}
