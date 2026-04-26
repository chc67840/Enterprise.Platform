# 05 — Store Layer

NGRX SignalStore (`@ngrx/signals`) is the chosen state primitive. Stores live in `state/<feature>.store.ts` and are provided at the feature route level so their lifetime tracks navigation in/out.

## Anatomy

A signalStore has four sections:

```ts
export const UsersStore = signalStore(
  // 1. PROVIDER — omitted here so route owns the lifetime
  withState<UsersState>(initialState),         // 2. STATE — the underlying signals
  withComputed((store) => ({ ... })),          // 3. COMPUTED — derived signals
  withMethods((store) => ({ ... })),           // 4. METHODS — sync + async actions
);
```

Real-world example (excerpts from `features/users/state/users.store.ts`):

```ts
// 1. PROVIDER LIFETIME — declared in users.routes.ts: providers: [UsersStore]
//    Result: store instance lives only while user is somewhere under /users.
//    Navigating away → store destroyed → memory freed.

// 2. STATE
interface UsersState {
  readonly ids: readonly string[];
  readonly entities: Readonly<Record<string, UserDto>>;
  readonly activeId: string | null;
  readonly listParams: ListUsersParams;
  readonly total: number;
  readonly loading: boolean;
  readonly loadingDetail: boolean;
  readonly saving: boolean;
  readonly error: ApiError | null;
}

const initialState: UsersState = {
  ids: [], entities: {}, activeId: null,
  listParams: DEFAULT_LIST_PARAMS, total: 0,
  loading: false, loadingDetail: false, saving: false, error: null,
};

// 3. COMPUTED
withComputed((store) => ({
  items: computed(() => {
    const dict = store.entities();
    return store.ids().map((id) => dict[id]).filter((u): u is UserDto => u !== undefined);
  }),
  active: computed(() => {
    const id = store.activeId();
    return id ? (store.entities()[id] ?? null) : null;
  }),
  isEmpty: computed(() => store.ids().length === 0 && !store.loading()),
})),

// 4. METHODS
withMethods((store) => {
  const api = inject(UsersApiService);
  const notify = inject(NotificationService);

  const upsert = (user: UserDto): void => { /* helper */ };
  const refreshAfterMutation = (id: string): void => { /* helper */ };

  return {
    loadList: rxMethod<Partial<ListUsersParams> | void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap((override) => {
          const next = override ? { ...store.listParams(), ...override } : store.listParams();
          return api.list(next).pipe(
            tapResponse({
              next: (resp) => { /* normalize → patchState */ },
              error: (error: ApiError) => patchState(store, { loading: false, error }),
            }),
          );
        }),
      ),
    ),

    setActive(id: string | null): void {
      patchState(store, { activeId: id });
    },

    // ... loadById, createUser, renameUser, changeEmail, activateUser, deactivateUser
  };
}),
```

## Decisions explained

### Why route-level providers, not `providedIn: 'root'`?

```ts
// users.routes.ts
{ path: '', providers: [UsersStore], children: [...] }
```

Two wins:

1. **Lifetime tracks navigation.** User leaves `/users` → store instance destroyed → cache freed. List of 50,000 users doesn't sit in memory across the whole session.
2. **Tests get a fresh store per scope.** `TestBed.configureTestingModule({ providers: [UsersStore, mockApi] })` gives a clean state per spec.

Use `providedIn: 'root'` only when the state genuinely is process-wide (auth, theme, domain selection — those are root services, not feature stores).

### Why `rxMethod` for async operations?

`rxMethod<T>` is NGRX Signals' bridge between an imperative-feeling store method and the underlying RxJS pipeline. It:

- Accepts `T | Signal<T> | Observable<T>` as input — call `store.loadList()` (void), `store.loadList({ search: 'x' })` (value), or pipe a signal in
- Provides automatic subscription management — the inner observable is unsubscribed when the store is destroyed
- Exposes the stream so you can transform with RxJS operators

### Why `tapResponse` not plain `subscribe` or `tap`?

```ts
api.list(next).pipe(
  tapResponse({
    next: (resp) => patchState(store, { ...resp, loading: false }),
    error: (error: ApiError) => patchState(store, { loading: false, error }),
  }),
),
```

`tapResponse` wraps the inner observable so that:
- A throw in `next` doesn't kill the outer rxMethod stream — the next call still works
- An error from the http stream lands in `error` cleanly without needing `catchError` boilerplate
- It returns the original observable, so the rxMethod can still complete normally

If you `subscribe` instead, an error would unsubscribe the inner observable AND if your subscriber throws, the outer rxMethod stream dies.

### Why `switchMap` (not `mergeMap` or `concatMap`)?

For paged loads or detail fetches, we want **last-write-wins**. User clicks page 2, then quickly clicks page 3 — only page 3's response should populate the state. `switchMap` cancels the page-2 request mid-flight when page-3 fires.

For mutations (create/rename/activate), `switchMap` also works because the user can only have ONE pending mutation per row at a time in normal UX. If you have a feature where queueing matters (uploading 5 files in sequence), use `concatMap`.

### Loading flags — three flavors

| Flag | When |
|---|---|
| `loading` | Top-level list/page load. Drives skeleton vs. populated table. |
| `loadingDetail` | Single-record fetch. Drives skeleton vs. populated detail panel. |
| `saving` | Mutation in flight. Drives "Save..." button spinner + disabled state. |

Three flags, not one — because UX needs them differentiated. A list reload while a save is in flight should keep the save spinner visible, not flicker the whole page back to skeleton.

### Why one `error` signal instead of per-method errors?

A feature usually has at most ONE error condition the user sees at a time (the most recent one). The error interceptor already shows toasts; the store's `error` signal is for inline contextual error UI ("retry this load"). One signal keeps the contract simple. Cleared at the start of every method.

### `entities` map + `ids` array — the normalized shape

```ts
ids: readonly string[]                       // ordered ids on current page
entities: Readonly<Record<string, UserDto>>  // id → DTO (may include cached items not on current page)
```

This is the standard normalized cache pattern:

- **`ids`** preserves backend ordering for the current page
- **`entities`** is a dict so detail lookups are O(1)
- Updating one user (`upsert`) is a partial dict update — Angular signal change-detection diffs it efficiently

The `items` computed signal materializes the array view from the dict + ids.

### Mutations: refresh-after-mutation, not optimistic

```ts
renameUser: rxMethod<{ id: string; request: RenameUserRequest }>(
  pipe(
    tap(() => patchState(store, { saving: true, error: null })),
    switchMap(({ id, request }) =>
      api.rename(id, request).pipe(
        tapResponse({
          next: () => {
            patchState(store, { saving: false });
            refreshAfterMutation(id);   // ← re-fetch the row, server is source of truth
            notify.success('User renamed', '...');
          },
          error: (error: ApiError) => patchState(store, { saving: false, error }),
        }),
      ),
    ),
  ),
),
```

The simpler default: server returns 204 → we re-fetch the affected row → state matches server. Optimistic updates are an optional optimization for UX-critical paths (typing a comment) but introduce reconciliation complexity (what if the server rejected the change?). Default to refresh-after-mutation; opt into optimism per-method when measurably needed.

## Public type for view consumers

```ts
export type UsersStoreType = InstanceType<typeof UsersStore>;
```

Exporting this type lets components annotate `protected readonly store: UsersStoreType = inject(UsersStore)` cleanly without `typeof` ergonomics in templates. Optional but tidy.

## Optional extensions

- **`withHooks(...)`** — `onInit` / `onDestroy` hooks. Use for setting up cross-store synchronisation (e.g. clear cache when user logs out).
- **`withEntities<T>()`** — NGRX entity adapter when the normalized cache pattern is the dominant shape. We hand-rolled `ids/entities` in Users because we needed custom ordering preservation, but for many features the adapter is a clean fit.
- **`withDevtools(name)`** — Redux DevTools integration. Useful when debugging. Add to root-provided stores; skip for short-lived feature stores.
- **`signalStoreFeature(...)`** — extract a reusable slice (e.g. paginated-list-with-search) and compose it into multiple stores. We don't have this yet because we have one list store. When we have three, the duplication will reveal what the feature should look like.
