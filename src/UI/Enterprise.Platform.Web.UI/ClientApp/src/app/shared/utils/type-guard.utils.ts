/**
 * ─── shared/utils/type-guard ────────────────────────────────────────────────────
 *
 * Narrowing helpers for `unknown`/`null`/`undefined` boundaries — API
 * responses, route data, query params, third-party callbacks. Each is a
 * pure function, zero dependencies.
 *
 * Use these instead of inline `typeof x === 'string'` so the narrowing
 * intent shows up at the callsite name (`isString(x)` reads as a guard,
 * the inline form reads as a check).
 */

/** True when v is neither null nor undefined. Narrows the type accordingly. */
export const isDefined = <T>(v: T | null | undefined): v is T =>
  v !== null && v !== undefined;

/** True when v is null or undefined. */
export const isNullish = (v: unknown): v is null | undefined =>
  v === null || v === undefined;

export const isString = (v: unknown): v is string => typeof v === 'string';

/** Number guard that ALSO rejects NaN (the JavaScript footgun). */
export const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && !Number.isNaN(v);

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

export const isFunction = (v: unknown): v is (...args: unknown[]) => unknown =>
  typeof v === 'function';

/** Plain-object guard. Excludes arrays + null. */
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isArray = <T = unknown>(v: unknown): v is T[] => Array.isArray(v);

/**
 * Truthy emptiness check across strings, arrays, plain objects, and
 * nullish. Useful for "render an empty state" branches.
 */
export const isEmpty = (
  v: string | unknown[] | Record<string, unknown> | null | undefined,
): boolean => {
  if (isNullish(v)) return true;
  if (isString(v) || isArray(v)) return v.length === 0;
  if (isObject(v)) return Object.keys(v).length === 0;
  return false;
};
