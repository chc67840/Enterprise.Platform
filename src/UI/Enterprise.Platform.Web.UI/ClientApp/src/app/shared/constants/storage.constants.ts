/**
 * ─── shared/constants/storage ───────────────────────────────────────────────────
 *
 * Single source of truth for every browser storage key the app uses.
 *
 * Why centralize:
 *   - Renaming a key (e.g. for a major version bump) is a one-line edit
 *     here instead of a grep across the whole codebase
 *   - Catches typo collisions at compile time (`STORAGE_KEYS.THEME` vs
 *     `'app:them'` is a silent bug; the constant is a TypeScript error)
 *   - Documents the EXACT keyspace this app owns in the user's browser
 *     (auditable for privacy / GDPR data-subject-access compliance)
 *
 * Naming convention: `app:<area>:<purpose>` — colon-separated, all
 * lowercase, never collides with libraries that own `_<libname>` keys.
 *
 * Function-valued entries take a discriminator and produce a parameterized
 * key — used when many instances of the same concept have unique state
 * (e.g. one dismissable banner per id).
 */

export const STORAGE_KEYS = {
  /*
   * Key strings preserve their EXISTING values — renaming a key here
   * would orphan any data saved under the old name (theme preference,
   * active domain, banner dismissals all stop persisting silently).
   * Treat key strings as a contract with the deployed user base.
   */

  /** Theme mode preference: 'light' | 'dark' | 'system'. */
  THEME: 'ep:theme-mode',

  /** Status-banner dismissed-id list (JSON array of strings). */
  BANNER_DISMISSED: 'ep:status-banner:dismissed',

  /** Cookie consent acknowledgement — 'accepted' | 'rejected'. */
  COOKIE_CONSENT: 'ep:cookie-consent:accepted',
} as const;

/** Compile-time-checked union of every key string the app may write. */
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
