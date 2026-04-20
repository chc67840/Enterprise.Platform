/**
 * ─── createEntityStore<T>() — BASE STORE FACTORY ────────────────────────────────
 *
 * WHY
 *   The single reusable primitive that gives every feature a full CRUD store
 *   in ~4 lines of feature code:
 *
 *     ```ts
 *     export const UsersStore = createEntityStore<User>({
 *       serviceType: UsersApiService,
 *       entityName: 'User',
 *     });
 *     ```
 *
 *   That one declaration yields signals for loading/saving/deleting/error,
 *   normalized entity storage, pagination, search, selection, computed
 *   conveniences (allEntities, activeEntity, entityCount, isEmpty), plus CRUD
 *   methods (loadAll / loadById / create / update / delete / invalidate).
 *
 * ARCHITECTURE RULES BAKED IN
 *   - **Single-source error-UX.** Stores capture `ApiError` into their `error`
 *     signal but never call `notify.error(...)`. Toasting is the error
 *     interceptor's sole responsibility (Architecture §4.3).
 *   - **Success toasts** belong to the store (user-action confirmation).
 *   - **Optimistic updates** on `update` with `If-Match`: patch state first,
 *     roll back on 409 Conflict so mid-air collisions don't corrupt local state.
 *   - **Cache TTL consulted** in `loadAllIfStale` — skips refetch when fresh.
 *   - **rxMethod** wraps every async method so successive invocations cancel
 *     prior in-flight calls via `switchMap`.
 *
 * COMPOSITION
 *   signalStore(
 *     withState<EntityDataState<T>>       // ids + entities + activeId + cache markers
 *     withLoadingState                    // loading / saving / deleting / error
 *     withPagination(defaultPageSize)     // page / pageSize / total / hasNext / hasPrev
 *     withSearch                          // queryParams + setSearchQuery/Sort/Filter
 *     withSelection                       // selectedIds (multi-select support)
 *     withComputed                        // allEntities / activeEntity / entityCount / isEmpty
 *     withMethods                         // CRUD methods
 *   )
 */
import { computed, inject, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';

import type { BaseApiService } from '@core/http/base-api.service';
import type {
  ApiError,
  ApiResponse,
  BaseEntity,
  PagedResponse,
  QueryParams,
} from '@core/models';
import { NotificationService } from '@core/services/notification.service';

import {
  DEFAULT_CACHE_TTL_MS,
  type EntityDataState,
  createInitialEntityState,
} from './base-entity.types';
import {
  withLoadingState,
  withPagination,
  withSearch,
  withSelection,
} from './store-features';

/** Factory configuration — the only hand-rolled piece per feature. */
export interface EntityStoreConfig<T extends BaseEntity> {
  /** Feature API service class. Injected at method time so store is lazy-friendly. */
  readonly serviceType: Type<BaseApiService<T>>;

  /** Human-readable name for success toasts (e.g. `'User'`). */
  readonly entityName: string;

  /**
   * Provision mode:
   *   - `'root'` — provided app-wide; same instance across navigations.
   *   - `null` (default) — feature route provides it via `providers: [FooStore]`;
   *     each route visit gets a fresh instance. Memory-friendly for large lists.
   */
  readonly providedIn?: 'root' | null;

  /** Default page size. Every list request starts here. */
  readonly defaultPageSize?: number;

  /**
   * Whether to fire success toasts on create / update / delete. Error toasts
   * are always owned by the error interceptor; this flag only controls the
   * success path (e.g. "User created successfully").
   */
  readonly showNotifications?: boolean;

  /** Cache TTL in ms for `loadAllIfStale`. Defaults to `DEFAULT_CACHE_TTL_MS` (5 min). */
  readonly cacheTtlMs?: number;
}

/**
 * Builds a signal store class with full CRUD + pagination + search + selection.
 * Call this at module top-level; provide the returned class in DI.
 */
export function createEntityStore<T extends BaseEntity>(config: EntityStoreConfig<T>) {
  const {
    serviceType,
    entityName,
    providedIn = null,
    defaultPageSize = 20,
    showNotifications = true,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  } = config;

  // `providedIn` is either `'root'` or omitted. Passing `null` to signalStore
  // is not valid — use the shorthand object form with conditional spread.
  const providedInOption = providedIn === 'root' ? { providedIn: 'root' as const } : {};

  return signalStore(
    providedInOption,

    // 1. Normalized entity data
    withState<EntityDataState<T>>(createInitialEntityState<T>()),

    // 2. Loading / saving / deleting / error signals + setters
    withLoadingState(),

    // 3. Page / pageSize / total + hasNext / hasPrev
    withPagination(defaultPageSize),

    // 4. Query params + search/sort/filter setters
    withSearch(),

    // 5. Row selection
    withSelection(),

    // 6. Computed conveniences
    withComputed((store) => ({
      /** Ordered array reconstructed from ids + entities dict. */
      allEntities: computed(() => {
        const dict = store.entities();
        return store
          .ids()
          .map((id) => dict[id])
          .filter((entity): entity is T => entity !== undefined);
      }),

      /** Currently-active entity for detail views. `null` when none. */
      activeEntity: computed(() => {
        const id = store.activeId();
        return id ? (store.entities()[id] ?? null) : null;
      }),

      /** Count of entities currently in state. */
      entityCount: computed(() => store.ids().length),

      /** True when the list is empty. Distinct from `!loading` — absence vs. not-yet-loaded. */
      isEmpty: computed(() => store.ids().length === 0),
    })),

    // 7. CRUD methods + invalidate
    withMethods((store) => {
      const api = inject(serviceType);
      const notify = showNotifications ? inject(NotificationService) : null;

      /** Evaluates whether a cache refetch is needed. */
      const shouldReload = (): boolean => {
        if (store.isStale()) return true;
        const age = Date.now() - store.lastLoadedAt();
        return age > cacheTtlMs;
      };

      return {
        /**
         * GET list. Merges partial overrides over the current `queryParams`
         * so callers can say `loadAll({ page: 2 })` without restating the rest.
         *
         * rxMethod + switchMap: rapid calls (e.g. user typing in search)
         * cancel prior in-flight requests so only the latest response wins.
         */
        loadAll: rxMethod<Partial<QueryParams> | void>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap((override) => {
              const queryParams: QueryParams = override
                ? { ...store.queryParams(), ...override }
                : store.queryParams();

              return api.getAll(queryParams).pipe(
                tapResponse({
                  next: (resp: PagedResponse<T>) => {
                    // Normalize: array → (ids, entities dict).
                    const ids = resp.data.map((e) => e.id);
                    const entities: Record<string, T> = {};
                    for (const e of resp.data) {
                      entities[e.id] = e;
                    }

                    patchState(store, {
                      ids,
                      entities,
                      loading: false,
                      lastLoadedAt: Date.now(),
                      isStale: false,
                      page: resp.page,
                      pageSize: resp.pageSize,
                      total: resp.total,
                      totalPages: resp.totalPages,
                    });
                  },
                  error: (error: ApiError) =>
                    // NOTE: no notify.error — the error interceptor owns HTTP toasts.
                    patchState(store, { loading: false, error }),
                }),
              );
            }),
          ),
        ),

        /** Loads list only if cache is stale. Lets navigation re-visits skip refetch. */
        loadAllIfStale(): void {
          if (shouldReload()) {
            (this as unknown as { loadAll: (p?: Partial<QueryParams>) => void }).loadAll();
          }
        },

        /** GET detail by id. Patches the entity into the dict and sets `activeId`. */
        loadById: rxMethod<string>(
          pipe(
            tap(() => patchState(store, { loadingDetail: true, error: null })),
            switchMap((id) =>
              api.getById(id).pipe(
                tapResponse({
                  next: (resp: ApiResponse<T>) => {
                    const entity = resp.data;
                    const existingIds = store.ids();
                    patchState(store, {
                      entities: { ...store.entities(), [entity.id]: entity },
                      ids: existingIds.includes(entity.id) ? existingIds : [...existingIds, entity.id],
                      activeId: entity.id,
                      loadingDetail: false,
                    });
                  },
                  error: (error: ApiError) =>
                    patchState(store, { loadingDetail: false, error }),
                }),
              ),
            ),
          ),
        ),

        /** Creates a new entity. Refetch-on-success would force a round-trip; we prepend to the list instead. */
        createEntity: rxMethod<Partial<T>>(
          pipe(
            tap(() => patchState(store, { saving: true, error: null })),
            switchMap((draft) =>
              api.create(draft).pipe(
                tapResponse({
                  next: (resp: ApiResponse<T>) => {
                    const created = resp.data;
                    patchState(store, {
                      ids: [created.id, ...store.ids()],
                      entities: { ...store.entities(), [created.id]: created },
                      total: store.total() + 1,
                      saving: false,
                      isStale: true, // next list view re-fetches to see server-sorted order
                    });
                    notify?.success(`${entityName} created`, `${entityName} was created successfully.`);
                  },
                  error: (error: ApiError) => patchState(store, { saving: false, error }),
                }),
              ),
            ),
          ),
        ),

        /**
         * Optimistic update.
         *
         * Patches state first, then sends the request. On 409 Conflict
         * (optimistic-concurrency mismatch), rolls back to the pre-patch
         * value so the UI reflects what the server actually has. Stores are
         * self-correcting — no manual refetch required in the caller.
         */
        updateEntity: rxMethod<{ id: string; changes: Partial<T> }>(
          pipe(
            tap(({ id, changes }) => {
              const snapshot = store.entities()[id];
              const patched = { ...snapshot, ...changes } as T;
              patchState(store, {
                saving: true,
                error: null,
                entities: { ...store.entities(), [id]: patched },
              });
              // Stash snapshot on the closure so the switchMap below can roll back.
              (rollbackMap as Map<string, T | undefined>).set(id, snapshot);
            }),
            switchMap(({ id, changes }) =>
              api.update(id, changes).pipe(
                tapResponse({
                  next: (resp: ApiResponse<T>) => {
                    const server = resp.data;
                    patchState(store, {
                      entities: { ...store.entities(), [id]: server },
                      saving: false,
                    });
                    (rollbackMap as Map<string, T | undefined>).delete(id);
                    notify?.success(`${entityName} updated`, `${entityName} was updated successfully.`);
                  },
                  error: (error: ApiError) => {
                    const snapshot = (rollbackMap as Map<string, T | undefined>).get(id);
                    // Roll back to snapshot (or remove if the row didn't exist locally before).
                    const entities = { ...store.entities() };
                    if (snapshot) {
                      entities[id] = snapshot;
                    } else {
                      delete entities[id];
                    }
                    patchState(store, { entities, saving: false, error });
                    (rollbackMap as Map<string, T | undefined>).delete(id);
                    // No notify — error interceptor has already toasted.
                  },
                }),
              ),
            ),
          ),
        ),

        /** Deletes an entity. On success prunes ids + entities + selection. */
        deleteEntity: rxMethod<string>(
          pipe(
            tap(() => patchState(store, { deleting: true, error: null })),
            switchMap((id) =>
              api.delete(id).pipe(
                tapResponse({
                  next: () => {
                    const entities = { ...store.entities() };
                    delete entities[id];
                    patchState(store, {
                      ids: store.ids().filter((x) => x !== id),
                      entities,
                      selectedIds: store.selectedIds().filter((x) => x !== id),
                      activeId: store.activeId() === id ? null : store.activeId(),
                      total: Math.max(0, store.total() - 1),
                      deleting: false,
                      isStale: true,
                    });
                    notify?.success(`${entityName} deleted`, `${entityName} was deleted successfully.`);
                  },
                  error: (error: ApiError) => patchState(store, { deleting: false, error }),
                }),
              ),
            ),
          ),
        ),

        /** Manually marks data as stale so the next `loadAllIfStale()` refetches. */
        invalidate(): void {
          patchState(store, { isStale: true });
        },

        /** Sets the active entity (for detail view binding). */
        setActive(id: string | null): void {
          patchState(store, { activeId: id });
        },
      };
    }),
  );
}

/**
 * Rollback snapshot map for optimistic updates. Lives outside the store
 * instance so the in-flight request closure can see the value it stashed
 * even after state mutations. Keyed by entity id.
 *
 * Memory impact: at most one entry per concurrent update — the entry is
 * removed on success or failure resolution, never leaked.
 */
const rollbackMap = new Map<string, unknown>();
