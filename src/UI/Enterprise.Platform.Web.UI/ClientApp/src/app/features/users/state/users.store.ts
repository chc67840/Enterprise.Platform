/**
 * ─── USERS STORE ────────────────────────────────────────────────────────────────
 *
 * Hand-rolled `signalStore` rather than `createEntityStore<User>` because:
 *
 *   1. Backend response shape is `PagedResult<UserDto>` (`items` / `pageNumber`
 *      / `totalCount`) not `PagedResponse<T>` (`data` / `page` / `total`) —
 *      the generic store would need a translation hook for every method.
 *   2. Mutations are CQRS verbs (`rename`, `changeEmail`, `activate`,
 *      `deactivate`) not the generic `update(id, partial)` the base assumes.
 *   3. We don't need optimistic-update rollback on these endpoints — every
 *      mutation returns 204 and we re-fetch the affected row to refresh state
 *      (the backend has cache-region invalidation; our local cache is the
 *      `entities` map which we surgically refresh on success).
 *
 * What this store owns:
 *   - paged list state (items, total, page, pageSize, filters)
 *   - per-id detail cache (`entities` map)
 *   - in-flight flags (`loading`, `loadingDetail`, `saving`)
 *   - last error (single signal — error interceptor still owns toasts)
 *   - methods covering every UsersApiService surface
 *
 * What this store does NOT own:
 *   - HTTP error toasts → `errorInterceptor`
 *   - Cache-busting across stores → would use `CacheInvalidationBus` if the
 *     UI had peer stores depending on user state; keep simple for now.
 */
import { computed, inject } from '@angular/core';
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

import type { ApiError } from '@core/models';
import { NotificationService } from '@core/services/notification.service';

import { UsersApiService } from '../data/users-api.service';
import {
  DEFAULT_LIST_PARAMS,
  type ChangeUserEmailRequest,
  type CreateUserRequest,
  type DeactivateUserRequest,
  type ListUsersParams,
  type ListUsersResponse,
  type RenameUserRequest,
  type UserDto,
} from '../data/user.types';

// ─── state shape ─────────────────────────────────────────────────────────────

interface UsersState {
  /** Ordered ids on the current page (matches backend ordering). */
  readonly ids: readonly string[];
  /** id → DTO. Includes any user fetched via `loadById`, even if not on current list page. */
  readonly entities: Readonly<Record<string, UserDto>>;
  /** Currently-active user id for the detail view. `null` when none selected. */
  readonly activeId: string | null;

  /** Paging + filter inputs that produced the current `ids` page. */
  readonly listParams: ListUsersParams;
  /** Total matching rows across all pages (server-reported). */
  readonly total: number;

  readonly loading: boolean;
  readonly loadingDetail: boolean;
  readonly saving: boolean;

  /** Last failure surfaced by any method. Cleared before each call. */
  readonly error: ApiError | null;
}

const initialState: UsersState = {
  ids: [],
  entities: {},
  activeId: null,
  listParams: DEFAULT_LIST_PARAMS,
  total: 0,
  loading: false,
  loadingDetail: false,
  saving: false,
  error: null,
};

// ─── store ───────────────────────────────────────────────────────────────────

export const UsersStore = signalStore(
  // No `providedIn: 'root'` — feature route owns the lifetime, so navigating
  // away frees the cache (single-tenant test app; large user lists could
  // otherwise sit in memory across the whole session).
  withState<UsersState>(initialState),

  withComputed((store) => ({
    /** Materialised list for the current page, in server order. */
    items: computed(() => {
      const dict = store.entities();
      return store
        .ids()
        .map((id) => dict[id])
        .filter((u): u is UserDto => u !== undefined);
    }),

    /** Active user (detail view binds to this). */
    active: computed(() => {
      const id = store.activeId();
      return id ? (store.entities()[id] ?? null) : null;
    }),

    /** True when the current page is empty AND we're not in the middle of loading. */
    isEmpty: computed(() => store.ids().length === 0 && !store.loading()),
  })),

  withMethods((store) => {
    const api = inject(UsersApiService);
    const notify = inject(NotificationService);

    /** Patches an entity in-place. Used after every successful mutation to keep state fresh. */
    const upsert = (user: UserDto): void => {
      const ids = store.ids().includes(user.id) ? store.ids() : [user.id, ...store.ids()];
      patchState(store, {
        entities: { ...store.entities(), [user.id]: user },
        ids,
      });
    };

    /** Re-fetches the affected user after a 204 mutation so local state matches the server. */
    const refreshAfterMutation = (id: string): void => {
      api.getById(id).subscribe({
        next: (fresh) => upsert(fresh),
        error: () => {
          // Already handled by the error interceptor; just don't crash the .subscribe.
        },
      });
    };

    return {
      // ── reads ─────────────────────────────────────────────────────────

      /** Loads a page; merges partial overrides over current `listParams`. */
      loadList: rxMethod<Partial<ListUsersParams> | void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((override) => {
            const next: ListUsersParams = override
              ? { ...store.listParams(), ...override }
              : store.listParams();
            return api.list(next).pipe(
              tapResponse({
                next: (resp: ListUsersResponse) => {
                  // Normalize: array → (ids, entities dict). Preserve any
                  // already-cached users not on this page so the detail view
                  // doesn't lose them when the user paginates away.
                  const dict = { ...store.entities() };
                  const ids = resp.items.map((u) => {
                    dict[u.id] = u;
                    return u.id;
                  });
                  patchState(store, {
                    ids,
                    entities: dict,
                    listParams: next,
                    total: resp.totalCount ?? resp.items.length,
                    loading: false,
                  });
                },
                error: (error: ApiError) => patchState(store, { loading: false, error }),
              }),
            );
          }),
        ),
      ),

      /** Loads a single user (detail view). Caches into `entities` + sets `activeId`. */
      loadById: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loadingDetail: true, error: null })),
          switchMap((id) =>
            api.getById(id).pipe(
              tapResponse({
                next: (user: UserDto) => {
                  upsert(user);
                  patchState(store, { activeId: user.id, loadingDetail: false });
                },
                error: (error: ApiError) => patchState(store, { loadingDetail: false, error }),
              }),
            ),
          ),
        ),
      ),

      /** Sets the active id (detail-route resolver / template binding). */
      setActive(id: string | null): void {
        patchState(store, { activeId: id });
      },

      // ── writes ────────────────────────────────────────────────────────

      /**
       * Creates a new user. On success: caches the returned DTO + invalidates
       * the list cache (consumer should call `loadList()` to see the new row
       * in correct sort order).
       */
      createUser: rxMethod<CreateUserRequest>(
        pipe(
          tap(() => patchState(store, { saving: true, error: null })),
          switchMap((request) =>
            api.create(request).pipe(
              tapResponse({
                next: (created: UserDto) => {
                  upsert(created);
                  patchState(store, { saving: false, activeId: created.id });
                  notify.success('User created', `${created.firstName} ${created.lastName} was added.`);
                },
                error: (error: ApiError) => patchState(store, { saving: false, error }),
              }),
            ),
          ),
        ),
      ),

      /** Renames a user. Refreshes the entity from the server on success. */
      renameUser: rxMethod<{ id: string; request: RenameUserRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, error: null })),
          switchMap(({ id, request }) =>
            api.rename(id, request).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User renamed', 'Name updated successfully.');
                },
                error: (error: ApiError) => patchState(store, { saving: false, error }),
              }),
            ),
          ),
        ),
      ),

      /** Changes a user's email. */
      changeEmail: rxMethod<{ id: string; request: ChangeUserEmailRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, error: null })),
          switchMap(({ id, request }) =>
            api.changeEmail(id, request).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('Email updated', 'New email saved successfully.');
                },
                error: (error: ApiError) => patchState(store, { saving: false, error }),
              }),
            ),
          ),
        ),
      ),

      /** Reactivates a user. */
      activateUser: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { saving: true, error: null })),
          switchMap((id) =>
            api.activate(id).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User activated', 'User can now sign in.');
                },
                error: (error: ApiError) => patchState(store, { saving: false, error }),
              }),
            ),
          ),
        ),
      ),

      /** Deactivates a user with a reason. */
      deactivateUser: rxMethod<{ id: string; request: DeactivateUserRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, error: null })),
          switchMap(({ id, request }) =>
            api.deactivate(id, request).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User deactivated', 'User can no longer sign in.');
                },
                error: (error: ApiError) => patchState(store, { saving: false, error }),
              }),
            ),
          ),
        ),
      ),
    };
  }),
);

/** Public type for components that inject the store. Avoids `typeof` ergonomics in templates. */
export type UsersStoreType = InstanceType<typeof UsersStore>;
