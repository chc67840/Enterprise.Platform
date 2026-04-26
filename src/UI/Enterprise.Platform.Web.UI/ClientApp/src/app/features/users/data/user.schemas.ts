/**
 * ─── USER FEATURE — RUNTIME SCHEMAS ─────────────────────────────────────────────
 *
 * Zod schemas mirror `user.types.ts`. Used to **validate inbound payloads** at
 * the API service boundary so a backend contract drift (renamed field, type
 * change, missing required) trips a clear error in dev/test rather than
 * propagating an `undefined` deep into the UI where the failure mode is a
 * blank cell or a NaN.
 *
 * In prod the schemas still run — the cost is a few µs per response, the
 * benefit is that customer-facing crashes get a typed exception with
 * field-level diagnostics instead of "cannot read properties of undefined".
 */
import { z } from 'zod';

/** ISO-8601 datetime with offset, as emitted by .NET `DateTimeOffset`. */
const isoDateTime = z.string().min(1);
const guid = z.uuid();

/** Mirrors {@link UserDto}. Property order matches generator output. */
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

/** Mirrors {@link ListUsersResponse}. */
export const listUsersResponseSchema = z.object({
  items: z.array(userDtoSchema),
  pageNumber: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalCount: z.number().int().nullable(),
});
