# 04 — Data Layer

The `data/` folder is the ONE place HTTP calls live for a feature. Three files: types, schemas, api service.

```
data/
├── <entity>.types.ts     ← TypeScript shapes
├── <entity>.schemas.ts   ← Zod schemas (runtime contracts)
└── <feature>-api.service.ts
```

## `<entity>.types.ts`

Plain TypeScript interfaces describing what crosses the wire. No business logic, no methods, no factories.

```ts
// features/users/data/user.types.ts (excerpt)

export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
  readonly isActive: boolean;
  readonly lastLoginAt: string | null;        // ISO-8601, NOT Date — see "Datetime" below
  readonly isDeleted: boolean;
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly modifiedAt: string | null;
  readonly modifiedBy: string | null;
}

export interface ListUsersResponse {
  readonly items: readonly UserDto[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number | null;
}

export interface ListUsersParams {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string | null;
  readonly activeOnly: boolean | null;
}

export interface CreateUserRequest {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
}
```

### Conventions

- **Every property `readonly`.** Backend responses are immutable from the UI's perspective. Mutations happen through commands, not field assignment.
- **`null`, not `undefined`.** Backend serializes nulls; round-trips are clean. `undefined` arrives as missing-field which is a different signal.
- **Datetimes as `string`.** ISO-8601 with offset (`"2026-04-26T15:00:00+00:00"`). Components format via `DatePipe`. Never materialize `Date` objects at the model layer — it imposes timezone interpretation too early.
- **`readonly Foo[]` for arrays.** Prevents accidental in-place mutation downstream.
- **`DEFAULT_X` constants** for any "starting params" the store needs (e.g. `DEFAULT_LIST_PARAMS`).

## `<entity>.schemas.ts`

Zod schemas mirroring the types. Used to validate inbound payloads at the API service boundary.

```ts
// features/users/data/user.schemas.ts (excerpt)
import { z } from 'zod';

const isoDateTime = z.string().min(1);
const guid = z.uuid();

export const userDtoSchema = z.object({
  id: guid,
  email: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  externalIdentityId: guid.nullable(),
  isActive: z.boolean(),
  lastLoginAt: isoDateTime.nullable(),
  isDeleted: z.boolean(),
  deletedAt: isoDateTime.nullable(),
  deletedBy: z.string().nullable(),
  createdAt: isoDateTime,
  createdBy: z.string(),
  modifiedAt: isoDateTime.nullable(),
  modifiedBy: z.string().nullable(),
});

export const listUsersResponseSchema = z.object({
  items: z.array(userDtoSchema),
  pageNumber: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalCount: z.number().int().nullable(),
});
```

### Why schemas exist alongside the types

| Without schemas | With schemas |
|---|---|
| Backend renames `firstName → givenName` → UI shows blank cells where firstName used to be | Backend rename → `ZodError` thrown at the parse, caught by error interceptor, surfaces as a structured ApiError with field path |
| Backend changes type from `string` to `string \| null` → null bleeds into a `.toUpperCase()` somewhere → page crashes deep in a template | Type drift caught at the boundary with the offending payload logged |

The cost is a few microseconds per response. The benefit is that a contract drift surfaces as a typed exception you can search logs for, not a generic JS crash.

### When NOT to write a schema

A schema is only valuable if the response could realistically drift. For internal endpoints where backend + frontend are the same team in the same repo, it's still worth it (renames happen). For third-party APIs, it's mandatory.

For `void` responses (204 No Content from mutations), there's nothing to parse — skip.

## `<feature>-api.service.ts`

The HTTP wrapper. One per feature. Always `@Injectable({ providedIn: 'root' })`.

```ts
// features/users/data/users-api.service.ts (excerpt)
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private get url(): string { return `${this.baseUrl}/users`; }

  list(params: ListUsersParams): Observable<ListUsersResponse> {
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.activeOnly !== null) httpParams = httpParams.set('activeOnly', String(params.activeOnly));

    return this.http
      .get<unknown>(this.url, { params: httpParams })           // ← unknown, not the real type
      .pipe(map((body) => listUsersResponseSchema.parse(body))); // ← typed only after parse succeeds
  }

  getById(id: string): Observable<UserDto> {
    return this.http
      .get<unknown>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map((body) => userDtoSchema.parse(body)));
  }

  create(request: CreateUserRequest, options: MutationOptions = {}): Observable<UserDto> {
    return this.http
      .post<unknown>(this.url, request, { headers: this.idempotencyHeader(options) })
      .pipe(map((body) => userDtoSchema.parse(body)));
  }

  // ... rename, changeEmail, activate, deactivate

  private idempotencyHeader(options: MutationOptions): HttpHeaders {
    const key = options.idempotencyKey?.trim() || generateIdempotencyKey();
    return new HttpHeaders({ 'Idempotency-Key': key });
  }
}
```

### Rules

1. **`get<unknown>` then `.parse()`.** Don't claim a TypeScript type at the `http.get<T>` call — that's an unchecked cast. Use Zod to produce the typed value.
2. **Always pass `Idempotency-Key` on mutating verbs.** `generateIdempotencyKey()` from `@utils` returns a UUID. Backend's `IdempotencyEndpointFilter` collapses retries.
3. **Allow override of the idempotency key.** `MutationOptions.idempotencyKey?` — useful for form submits where the key should remain stable across user-triggered retries (button mash) so the server still recognises the duplicate.
4. **No try/catch, no error handling, no toast.** The error interceptor (chain step 8) handles 4xx/5xx → toast. The store handles loading flag toggles. The api service's only job is "send + receive + validate."
5. **`encodeURIComponent` for path params.** Never interpolate raw user input into URL paths.
6. **One method per backend endpoint.** No "convenience" methods that combine two calls — that belongs in the store.
7. **No caching, no dedup, no retry.** Those are interceptor concerns; the api service is a thin shell.

### CQRS-style verb endpoints

Our backend exposes mutations as verbs (`/users/{id}/activate`, `/users/{id}/deactivate`) rather than `PUT /users/{id}` full-replacement. The api service mirrors this 1:1:

```ts
activate(id: string, options: MutationOptions = {}): Observable<void> {
  return this.http.post<void>(
    `${this.url}/${encodeURIComponent(id)}/activate`,
    null,
    { headers: this.idempotencyHeader(options) },
  );
}
```

This is intentional — generic `update(id, partial)` would lose the per-action idempotency + audit story documented on the backend's command markers.

## Spec

`data/<feature>-api.service.spec.ts` exercises the boundary contract. See `10`.

## Optional extensions (build when needed)

- **Streaming endpoints** (SSE / WebSocket): add `<feature>-stream.service.ts` next to the api service. Don't conflate stream + REST in one file.
- **File uploads / downloads**: separate methods on the api service that bypass the JSON Zod path; document explicitly.
- **Optimistic update helpers**: keep them in the store, NOT the api service.
- **Backend pagination shape mismatch**: if the backend's `PagedResult<T>` shape doesn't match what your store wants, normalize in the api service's `.map()` step. Don't introduce a transformer interceptor for one feature.
