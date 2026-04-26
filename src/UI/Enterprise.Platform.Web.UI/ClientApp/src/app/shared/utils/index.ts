/**
 * Public surface for `@utils/*`.
 *
 * Add new utility functions to the appropriate category file (or a new
 * file when none fits) and re-export here. Per the standards-triage doc,
 * we only ship a utility when it has a real consumer or imminent use —
 * not speculatively.
 */

// Type guards
export {
  isArray,
  isBoolean,
  isDefined,
  isEmpty,
  isFunction,
  isNullish,
  isNumber,
  isObject,
  isString,
} from './type-guard.utils';

// Strings
export { maskString, slugify, toInitials, truncate } from './string.utils';

// Crypto
export {
  generateCorrelationId,
  generateIdempotencyKey,
  generateUuid,
} from './crypto.utils';

// Numbers
export {
  abbreviateNumber,
  clamp,
  formatCurrency,
  formatPercentage,
  roundTo,
} from './number.utils';

// Dates
export { addMinutes, formatCountdown, isExpired, toRelativeTime } from './date.utils';
