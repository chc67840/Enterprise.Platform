# 02 — First Feature Walkthrough

A 30-minute narrative tour through the **Users** feature — the canonical example. Read this end-to-end before opening `03–10`. Every concept the per-layer docs reference is shown here in motion.

We follow one user action: **the developer types `/users` into the URL bar and presses Enter.** We don't stop until they're looking at a populated list and have clicked into a single row.

---

## Setup

The Users feature lives at `src/app/features/users/`. Its complete file list:

```
features/users/
├── data/
│   ├── user.types.ts            ← TypeScript shapes for DTOs + requests
│   ├── user.schemas.ts          ← Zod schemas (runtime contract validation)
│   ├── users-api.service.ts     ← HttpClient wrapper around /api/v1/users/*
│   └── users-api.service.spec.ts
├── state/
│   └── users.store.ts           ← signalStore feature store
├── views/
│   ├── users-list.component.ts  ← page: GET /users + paginated grid
│   ├── user-detail.component.ts ← page: GET /users/:id + actions
│   └── user-create.component.ts ← page: POST /users form
└── users.routes.ts              ← lazy USERS_ROUTES, mounted at /users
```

That's the entire surface. No `index.ts` barrel (features are reached only through routes; no other feature imports their internals). No `services/` folder — the only service is the api service which already lives in `data/`.

---

## Step 1 — URL → Router match

`/users` matches the lazy route block in `app.routes.ts`:

```ts
{
  path: 'users',
  data: {
    label: 'Users',
    icon: 'pi-users',
    breadcrumb: 'Users',
    showInNav: true,
  } satisfies RouteMetadata,
  loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
}
```

This route is INSIDE the app-shell parent route, so `authGuard` (declared on the shell parent) has already run by the time we reach here. Result: signed-in users only.

`USERS_ROUTES` (declared in `features/users/users.routes.ts`):

```ts
export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [UsersStore],          // ← store lifetime tracks navigation in/out
    children: [
      { path: '',     loadComponent: () => import('./views/users-list.component').then(m => m.UsersListComponent),     data: { ... } },
      { path: 'new',  loadComponent: () => import('./views/user-create.component').then(m => m.UserCreateComponent),   data: { ... } },
      { path: ':id',  loadComponent: () => import('./views/user-detail.component').then(m => m.UserDetailComponent),   data: { ... } },
    ],
  },
];
```

Two important things happen here:

1. **`providers: [UsersStore]`** — NGRX Signal Stores can be `providedIn: 'root'` (process-wide singleton) OR provided at the route level (per-feature lifetime). We chose route-level so the user-list cache doesn't outlive its relevance + tests get a fresh store per scope.
2. **Lazy `loadComponent`** — each view downloads only when navigated to. The `users-list.component.ts` chunk lands when the user actually goes to `/users`.

---

## Step 2 — Route data → Sub-nav orchestrator

While the lazy chunk is downloading, the orchestrator (mounted in app-shell) reads `route.data` for the new route:

```ts
data: {
  pageHeader: {
    title: 'Users',
    subtitle: 'Browse and manage platform users.',
    icon: 'pi pi-users',
    primaryAction: { label: 'New user', icon: 'pi pi-plus', actionKey: 'users.create' },
  },
}
```

So before the page component even paints, the user already sees:

- The **breadcrumb** "Users" (from `data.breadcrumb` on the parent `/users` route — `BreadcrumbService` walks the route tree)
- The **page header** with title + subtitle + icon + "New user" CTA

This is the [sub-nav-orchestrator pattern](../UI-Sub-Nav-Zone.md). The page component never renders its own `<h1>`.

---

## Step 3 — `UsersListComponent` instantiates

The component is standalone, OnPush, signal-input. Its bones:

```ts
@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [/* table, paginator, etc. */],
  template: `
    @if (store.loading()) {
      <app-skeleton-list />
    } @else if (store.isEmpty()) {
      <app-empty-state title="No users" message="..." />
    } @else {
      <p-table [value]="store.items()" ...>
        @for (u of store.items(); track u.id) {
          <tr (click)="open(u.id)">
            <td>{{ u.firstName }} {{ u.lastName }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.isActive ? 'Active' : 'Inactive' }}</td>
          </tr>
        }
      </p-table>
    }
  `,
})
export class UsersListComponent {
  protected readonly store = inject(UsersStore);
  private readonly router  = inject(Router);

  constructor() {
    this.store.loadList();   // ← kick off the GET /users call
  }

  protected open(id: string): void {
    this.router.navigate(['/users', id]);
  }
}
```

Two observations:

- **The store is injected, not constructed.** Because `UsersStore` is declared in `providers: [UsersStore]` on the route, every component within the route gets the same instance.
- **Loading state is read directly from the store.** No local `loading` signal in the component. Single source of truth.

---

## Step 4 — `store.loadList()` → API call

`loadList` is an **`rxMethod`** — NGRX Signals' bridge between an imperative-feeling store method and the underlying RxJS observable that drives the actual side-effect.

```ts
loadList: rxMethod<Partial<ListUsersParams> | void>(
  pipe(
    tap(() => patchState(store, { loading: true, error: null })),
    switchMap((override) => {
      const next = override ? { ...store.listParams(), ...override } : store.listParams();
      return api.list(next).pipe(
        tapResponse({
          next: (resp) => {
            const dict = { ...store.entities() };
            const ids = resp.items.map((u) => { dict[u.id] = u; return u.id; });
            patchState(store, { ids, entities: dict, listParams: next, total: resp.totalCount, loading: false });
          },
          error: (error: ApiError) => patchState(store, { loading: false, error }),
        }),
      );
    }),
  ),
),
```

The flow:

1. `tap(() => patchState({ loading: true, error: null }))` — flips the loading flag synchronously. View re-renders to skeleton.
2. `switchMap(...)` — cancels any in-flight previous list call, kicks off the new one.
3. `api.list(next)` returns `Observable<ListUsersResponse>`.
4. `tapResponse` — NGRX operators idiom. `next` updates state on success; `error` updates state on failure.

**Why `tapResponse` not `subscribe`?** Because `subscribe` inside `rxMethod` would unsubscribe when the source completes. `tapResponse` wraps the inner observable so a thrown error in the consumer doesn't kill the outer rxMethod stream — next call still works.

---

## Step 5 — `UsersApiService.list(...)` → HTTP

```ts
list(params: ListUsersParams): Observable<ListUsersResponse> {
  let httpParams = new HttpParams()
    .set('page', String(params.page))
    .set('pageSize', String(params.pageSize));
  if (params.search) httpParams = httpParams.set('search', params.search);
  if (params.activeOnly !== null) httpParams = httpParams.set('activeOnly', String(params.activeOnly));

  return this.http
    .get<unknown>(this.url, { params: httpParams })
    .pipe(map((body) => listUsersResponseSchema.parse(body)));
}
```

Three things matter:

1. **`get<unknown>`** — we don't claim a type to TypeScript at the network boundary. The `.parse()` below is what produces the typed value.
2. **`listUsersResponseSchema.parse(body)`** — Zod runtime validation. If the backend returns `{ Items: [...] }` with a capital I instead of `items`, this throws a `ZodError` at the boundary instead of silently returning undefined that crashes the template later.
3. **No error handling here.** The error interceptor (chain step 8) already handles 4xx/5xx → toast notifications. The api service stays narrow.

---

## Step 6 — Interceptor chain processes the request

For every `/api/v1/users` call:

| # | Interceptor | What it does |
|---|---|---|
| 1 | correlation | Adds `X-Correlation-ID: <uuid>` so backend logs correlate with this UI action |
| 2 | security | Echoes `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header for same-origin |
| 3 | cache | GET-only response cache — returns cached body if still fresh |
| 4 | dedup | If two identical GETs are in-flight, the second piggybacks on the first |
| 5 | loading | `inflightCount++` → flips global progress bar visible |
| 6 | logging | Structured `info` log of method + URL + correlation id |
| 7 | retry | Wraps in retry policy (idempotent verbs only) |
| 8 | error | On 4xx/5xx: normalizes shape, fires toast notification, on 401 redirects to login |

The request lands at the BFF (`http://localhost:5001/api/proxy/v1/users?...`). The BFF reads the HttpOnly session cookie → adds the `Authorization: Bearer <token>` header → proxies to `https://api.../v1/users`. Angular never sees the access token.

---

## Step 7 — Response → Zod parse → store update → view re-render

Backend returns `200 OK`:

```json
{
  "items": [
    { "id": "...", "email": "...", "firstName": "Jane", "lastName": "Doe", "isActive": true, ... },
    ...
  ],
  "pageNumber": 1,
  "pageSize": 25,
  "totalCount": 47
}
```

`listUsersResponseSchema.parse(body)` validates every field. On success, the typed `ListUsersResponse` flows up to the rxMethod's `tapResponse.next` callback, which calls `patchState(...)` with `loading: false` + the new ids/entities/total.

`patchState` updates the store's underlying signals. Because every signal that the component reads (`store.loading()`, `store.items()`, `store.isEmpty()`) is subscribed via Angular's reactive graph, the change-detection cycle re-renders ONLY the components whose signal dependencies changed. The skeleton swaps to the populated table.

---

## Step 8 — User clicks a row → navigate `/users/123`

`open(id)` calls `this.router.navigate(['/users', id])`. The router:

1. Resolves `/users/123` against `USERS_ROUTES`.
2. Triggers `NavigationStart` → `PageHeaderService` auto-clears any service-set header, `BreadcrumbService` rebuilds trail from new route.
3. Lazy-loads `user-detail.component.ts` (small chunk, <20KB).
4. The same `UsersStore` instance persists (still under `providers: [UsersStore]` at the parent `''` route). State carries across.
5. `UserDetailComponent` constructs:

```ts
export class UserDetailComponent {
  readonly id = input.required<string>();   // populated by withComponentInputBinding from /:id

  protected readonly store = inject(UsersStore);
  private readonly pageHeader = inject(PageHeaderService);

  constructor() {
    effect(() => {
      const id = this.id();
      this.store.loadById(id);
    });

    // Once the active user resolves, set a dynamic page header
    effect(() => {
      const u = this.store.active();
      if (!u) return;
      this.pageHeader.set({
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        badge: { label: u.isActive ? 'ACTIVE' : 'INACTIVE', variant: u.isActive ? 'success' : 'neutral' },
        backRoute: '/users',
        primaryAction: { label: 'Edit', actionKey: 'users.edit' },
      });
    });
  }
}
```

Two wins:

- **`input.required<string>()` + `withComponentInputBinding()`** — no `ActivatedRoute` injection, no `paramMap` subscribe, no manual unsubscribe. The route param IS the signal input.
- **`PageHeaderService.set(...)` after data lands** — the page header reshapes from "Users / Detail" to "Jane Doe / jane@example.com / ACTIVE / Edit". Auto-clears on next navigation.

`loadById` follows the same rxMethod + tapResponse + Zod-parse pattern as `loadList`. The user is upserted into `store.entities` so re-visiting the row from the list page is instant (no re-fetch).

---

## Recap — the seven concepts you just used

| Concept | Where | Doc |
|---|---|---|
| Lazy route + per-feature store provider | `users.routes.ts` | `07` |
| `withComponentInputBinding` for route params | `user-detail.component.ts` | `06` |
| `inject(...)` for DI (no constructor) | every file | `06`, `04`, `05` |
| Zod parse at API boundary | `users-api.service.ts` | `04` |
| `signalStore` + `rxMethod` + `tapResponse` | `users.store.ts` | `05` |
| `@if loading() / isEmpty() / else table` | `users-list.component.ts` | `09` |
| `PageHeaderService.set(...)` for dynamic titles | `user-detail.component.ts` | `06` |

That's a complete feature. ~12 files, ~600 lines of TypeScript, 0 NgModules, 0 NgRx actions/reducers/effects, 0 `subscribe()` calls in component code.

Now read `03` for the folder skeleton you'll copy when adding YOUR first feature.
