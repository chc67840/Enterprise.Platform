/**
 * ─── BASE ENTITY ────────────────────────────────────────────────────────────────
 *
 * WHY
 *   Every domain entity the SPA fetches, displays, or mutates eventually persists
 *   to the backend. The backend already stamps audit columns (`CreatedAt/By`,
 *   `ModifiedAt/By`) on its `AuditableEntity` base class and a `RowVersion` for
 *   optimistic concurrency. This `BaseEntity` interface mirrors the server's
 *   contract so the client can:
 *
 *     1. Index entities by `id` inside stores (NGRX Signals stores normalise on id).
 *     2. Display audit metadata in detail views without per-feature work.
 *     3. Round-trip the concurrency token on `update`/`patch` via the `If-Match`
 *        header so mid-air collisions produce 409 Conflict instead of silent
 *        last-write-wins corruption.
 *
 * HOW IT'S USED
 *   - Every feature entity interface extends `BaseEntity`:
 *       `export interface User extends BaseEntity { firstName: string; ... }`
 *   - `BaseApiService<T extends BaseEntity>` requires `T` to have an `id`.
 *   - `createEntityStore<T extends BaseEntity>` uses `id` for the ids/entities
 *     dictionary and `version` for the optimistic-concurrency round-trip.
 *
 * FIELD RATIONALE
 *   - `id`           — required. Guid on the server; string here. Always non-null for persisted rows.
 *   - `createdAt`    — ISO-8601 UTC instant. Optional because new unsaved drafts
 *                      don't have one yet.
 *   - `createdBy`    — user id / system actor name (matches server's `IAuditableEntity.CreatedBy`).
 *   - `modifiedAt`   — ISO-8601 UTC instant; optional for records never edited.
 *   - `modifiedBy`   — user id / system actor name.
 *   - `isActive`     — soft-activation flag exposed by many aggregates (distinct
 *                      from `isDeleted` which the server hides via query filter).
 *   - `version`      — row version token (opaque to the client — base64 bytes).
 *                      Passed verbatim in `If-Match` on update/patch and echoed
 *                      back from the response. Never compared by value on the UI.
 */
export interface BaseEntity {
  /** Stable identity of the entity. Guid on the server; string here. */
  readonly id: string;

  /** ISO-8601 UTC instant the entity was created. Populated server-side. */
  readonly createdAt?: string;

  /** Actor that created the entity — user id as string, or `'system'` for background jobs. */
  readonly createdBy?: string;

  /** ISO-8601 UTC instant of the most recent modification. */
  readonly modifiedAt?: string;

  /** Actor that most recently modified the entity. */
  readonly modifiedBy?: string;

  /** Soft-activation flag. Not the same as soft-delete — deleted rows are hidden server-side. */
  readonly isActive?: boolean;

  /**
   * Optimistic-concurrency token. Opaque base64 string provided by the server
   * (backend maps this from `byte[] RowVersion`). The HTTP base service sends
   * it back as `If-Match: "<version>"` on `update`/`patch` so a 409 surfaces
   * when another client committed a change in the meantime.
   */
  readonly version?: string;
}
