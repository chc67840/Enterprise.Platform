/**
 * Public surface for `@constants/*`.
 *
 * Add new constant groups by category file (storage / http / route /
 * regex / ui / permission). Per the standards-triage doc, we only ship a
 * constants file when at least 2 callers exist for the values it holds —
 * not speculatively.
 */
export { STORAGE_KEYS, type StorageKey } from './storage.constants';
