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
 *   - last error (per-channel — list / detail / save) so views can show
 *     contextual retry affordances rather than a single global "error"
 *   - explicit `notFound` flag for the detail view (404 ≠ "transient
 *     error" — the route is logically wrong, not the network)
 *   - methods covering every UsersApiService surface
 *
 * What this store does NOT own:
 *   - HTTP error toasts → `errorInterceptor` (default path) OR component-
 *     local handling (when the call sets `suppressGlobalError: true`)
 *   - Cache-busting across stores → would use `CacheInvalidationBus` if the
 *     UI had peer stores depending on user state; keep simple for now.
 *   - Confirmation dialogs → component-level (UsersDetailComponent injects
 *     ConfirmationService and asks before calling `deactivateUser`).
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

  /** Last list-load failure. Cleared at the start of every `loadList`. */
  readonly listError: ApiError | null;
  /** Last detail-load failure (any non-404). */
  readonly detailError: ApiError | null;
  /** Set true when `getById` returned 404 — the view can route back to the list. */
  readonly notFound: boolean;
  /** Last mutation failure. Cleared at the start of every save. */
  readonly saveError: ApiError | null;
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
  listError: null,
  detailError: null,
  notFound: false,
  saveError: null,
};

/**
 * Map an `ApiError`'s status code to the SAVE-channel error. This pulls the
 * status into the state without losing the original message — the create form
 * uses it to render a dedicated message on the email field for 409 Conflict
 * (duplicate email) rather than a generic "save failed" toast.
 */
const isStatus = (error: ApiError | null, status: number): boolean =>
  !!error && error.statusCode === status;

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

    /**
     * True when no rows are loaded AND we're not loading AND no error fired —
     * the "intentionally empty" state. Distinguish from loading (spinner) and
     * error (retry button) at the view layer using these signals together.
     */
    isEmpty: computed(
      () => store.ids().length === 0 && !store.loading() && store.listError() === null,
    ),

    /**
     * True when filters are applied AND the result is empty — for the
     * "no matches" empty state. Differs from `isEmpty` (which fires for
     * "no users at all" too).
     */
    hasNoMatches: computed(() => {
      const p = store.listParams();
      const filtersApplied = p.search !== null || p.activeOnly !== null;
      return filtersApplied && store.ids().length === 0 && !store.loading();
    }),

    /** True if the most recent save failed with a 409 Conflict. */
    saveConflict: computed(() => isStatus(store.saveError(), 409)),
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

    /**
     * Re-fetches the affected user after a 204 mutation so local state matches the server.
     * Errors are swallowed here — the mutation already succeeded; if the refresh fails
     * (network blip, race), the user can refresh the page. We don't toast a misleading
     * "load failed" after a successful "user updated".
     */
    const refreshAfterMutation = (id: string): void => {
      api.getById(id, { suppressGlobalError: true }).subscribe({
        next: (fresh) => upsert(fresh),
        error: () => { /* swallow — see above */ },
      });
    };

    return {
      // ── reads ─────────────────────────────────────────────────────────

      /** Loads a page; merges partial overrides over current `listParams`. */
      loadList: rxMethod<Partial<ListUsersParams> | void>(
        pipe(
          tap(() => patchState(store, { loading: true, listError: null })),
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
                error: (error: ApiError) =>
                  patchState(store, { loading: false, listError: error }),
              }),
            );
          }),
        ),
      ),

      /**
       * Loads a single user (detail view). Caches into `entities` + sets
       * `activeId`. 404 sets `notFound: true` (the view routes back to the
       * list); other errors set `detailError` (the view shows retry).
       *
       * Suppresses the global error toast — this method has its own
       * UX (404 → navigate, 5xx → inline retry) so a top-right toast
       * would be redundant and confusing.
       */
      loadById: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              loadingDetail: true,
              detailError: null,
              notFound: false,
            }),
          ),
          switchMap((id) =>
            api.getById(id, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: (user: UserDto) => {
                  upsert(user);
                  patchState(store, {
                    activeId: user.id,
                    loadingDetail: false,
                    notFound: false,
                  });
                },
                error: (error: ApiError) => {
                  if (error.statusCode === 404) {
                    patchState(store, { loadingDetail: false, notFound: true });
                  } else {
                    patchState(store, { loadingDetail: false, detailError: error });
                  }
                },
              }),
            ),
          ),
        ),
      ),

      /** Sets the active id (detail-route resolver / template binding). */
      setActive(id: string | null): void {
        patchState(store, { activeId: id });
      },

      /** Resets the saveError signal. Forms call this when the user starts editing again. */
      clearSaveError(): void {
        patchState(store, { saveError: null });
      },

      // ── writes ────────────────────────────────────────────────────────

      /**
       * Creates a new user. On success: caches the returned DTO + sets
       * `activeId` (the view watches that signal to navigate to detail).
       *
       * Suppresses the global error toast — the create form binds to
       * `saveError()` directly so 400 (validation) and 409 (duplicate
       * email) render under the offending field.
       */
      createUser: rxMethod<CreateUserRequest>(
        pipe(
          tap(() => patchState(store, { saving: true, saveError: null })),
          switchMap((request) =>
            api.create(request, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: (created: UserDto) => {
                  upsert(created);
                  patchState(store, { saving: false, activeId: created.id });
                  notify.success(
                    'User created',
                    `${created.firstName} ${created.lastName} was added.`,
                  );
                },
                error: (error: ApiError) =>
                  patchState(store, { saving: false, saveError: error }),
              }),
            ),
          ),
        ),
      ),

      /** Renames a user. Refreshes the entity from the server on success. */
      renameUser: rxMethod<{ id: string; request: RenameUserRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, saveError: null })),
          switchMap(({ id, request }) =>
            api.rename(id, request, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User renamed', 'Name updated successfully.');
                },
                error: (error: ApiError) =>
                  patchState(store, { saving: false, saveError: error }),
              }),
            ),
          ),
        ),
      ),

      /** Changes a user's email. */
      changeEmail: rxMethod<{ id: string; request: ChangeUserEmailRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, saveError: null })),
          switchMap(({ id, request }) =>
            api.changeEmail(id, request, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('Email updated', 'New email saved successfully.');
                },
                error: (error: ApiError) =>
                  patchState(store, { saving: false, saveError: error }),
              }),
            ),
          ),
        ),
      ),

      /** Reactivates a user. */
      activateUser: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { saving: true, saveError: null })),
          switchMap((id) =>
            api.activate(id, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User activated', 'User can now sign in.');
                },
                error: (error: ApiError) =>
                  patchState(store, { saving: false, saveError: error }),
              }),
            ),
          ),
        ),
      ),

      /** Deactivates a user with a reason. */
      deactivateUser: rxMethod<{ id: string; request: DeactivateUserRequest }>(
        pipe(
          tap(() => patchState(store, { saving: true, saveError: null })),
          switchMap(({ id, request }) =>
            api.deactivate(id, request, { suppressGlobalError: true }).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { saving: false });
                  refreshAfterMutation(id);
                  notify.success('User deactivated', 'User can no longer sign in.');
                },
                error: (error: ApiError) =>
                  patchState(store, { saving: false, saveError: error }),
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

/**
 * Helper for views — `store.saveError()` exposes the raw `ApiError`; this
 * extracts a friendly per-field message for the create / rename forms.
 * Looks at lowercase keys too so backend `Email` (PascalCase ProblemDetails
 * convention) and frontend `email` both resolve.
 */
export function fieldErrorMessage(error: ApiError | null, field: string): string | null {
  if (!error?.errors) return null;
  const direct = error.errors[field];
  if (direct && direct.length > 0 && direct[0]) return direct[0];
  const titlecased = error.errors[field.charAt(0).toUpperCase() + field.slice(1)];
  if (titlecased && titlecased.length > 0 && titlecased[0]) return titlecased[0];
  return null;
}
