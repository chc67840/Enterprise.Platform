/**
 * ─── USER FEATURE — TYPES ───────────────────────────────────────────────────────
 *
 * Shapes that mirror the .NET DTOs emitted by `tools/Enterprise.Platform.DtoGen`
 * (see `src/Contracts/Enterprise.Platform.Contracts/DTOs/App/UserDto.cs`).
 *
 * All datetime fields land on the wire as ISO-8601 strings with offset
 * (e.g. `"2026-04-26T03:00:00+00:00"`), produced by .NET's default
 * `DateTimeOffset` serializer. We keep them as `string` here — UI components
 * format them via `DatePipe` at the boundary; we never try to materialise
 * `Date` objects at the model layer (avoids tz / parsing surprises).
 *
 * `null` is preferred over `undefined` for absent fields so JSON round-trips
 * cleanly in both directions.
 */

/**
 * A single user as returned by `/api/v1/users/{id}` and embedded in
 * `ListUsersResponse.items`.
 *
 * The `Record<string, unknown>` extension is required for compatibility with
 * the dph-data-table generic constraint — at runtime it has no effect; on the
 * type side it lets the table's column-renderer index into the row by string
 * field name without an explicit cast at every callsite.
 */
export interface UserDto extends Record<string, unknown> {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
  readonly isActive: boolean;
  readonly lastLoginAt: string | null;
  readonly isDeleted: boolean;
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly modifiedAt: string | null;
  readonly modifiedBy: string | null;
}

/**
 * Backend `PagedResult<UserDto>` envelope. Note the .NET shape — `items` /
 * `pageNumber` / `pageSize` / `totalCount`. **Different from the SPA's generic
 * `PagedResponse<T>`** (`data` / `total` / `page`); the users feature does its
 * own translation rather than introducing a transformer interceptor for
 * everyone (kept narrow because no other feature consumes this shape today).
 */
export interface ListUsersResponse {
  readonly items: readonly UserDto[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number | null;
}

/** Filters + paging for `GET /api/v1/users`. Matches `ListUsersQuery` on the backend. */
export interface ListUsersParams {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string | null;
  readonly activeOnly: boolean | null;
}

/** Defaults applied when the store hasn't been touched yet. Backend caps PageSize at 200. */
export const DEFAULT_LIST_PARAMS: ListUsersParams = {
  page: 1,
  pageSize: 25,
  search: null,
  activeOnly: null,
};

/** Body for `POST /api/v1/users`. Idempotency-Key rides as a header, not body. */
export interface CreateUserRequest {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly externalIdentityId: string | null;
}

/** Body for `PUT /api/v1/users/{id}/name`. */
export interface RenameUserRequest {
  readonly firstName: string;
  readonly lastName: string;
}

/** Body for `PUT /api/v1/users/{id}/email`. */
export interface ChangeUserEmailRequest {
  readonly email: string;
}

/** Body for `POST /api/v1/users/{id}/deactivate`. */
export interface DeactivateUserRequest {
  readonly reason: string;
}
