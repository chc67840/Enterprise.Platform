/**
 * ─── shared/utils/string ────────────────────────────────────────────────────────
 *
 * Pure string helpers. No dependencies, no side-effects, safe for any
 * runtime (browser or node-side render).
 */

/**
 * Truncates `str` to at most `maxLength` characters, appending `ellipsis`
 * (default `…`) when truncation occurs. Width is computed from the FINAL
 * string including the ellipsis — so `truncate('hello', 4)` returns `'h…'`,
 * not `'hell…'`.
 */
export function truncate(str: string, maxLength: number, ellipsis = '…'): string {
  if (str.length <= maxLength) return str;
  if (maxLength <= ellipsis.length) return ellipsis.slice(0, maxLength);
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * First-letter-of-first-and-last-name initials for an avatar fallback.
 * Single-name inputs return the first `maxChars` characters of that name,
 * upper-cased. Empty/blank input returns `'?'`.
 *
 *   toInitials('Jane Doe')        // 'JD'
 *   toInitials('Cher')            // 'CH'
 *   toInitials('Jean-Luc Picard') // 'JP'
 */
export function toInitials(name: string, maxChars = 2): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return (parts[0]!.slice(0, maxChars) || '?').toUpperCase();
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return ((first + last).slice(0, maxChars) || '?').toUpperCase();
}

/**
 * URL-safe slug. Lowercases, replaces non-word characters with hyphens,
 * collapses runs, and trims leading/trailing hyphens.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Masks a string keeping the last `visibleEnd` characters visible. Used
 * for displaying credit-card numbers, account ids, API keys.
 *
 *   maskString('4242424242424242') // '************4242'
 */
export function maskString(str: string, visibleEnd = 4, maskChar = '•'): string {
  if (str.length <= visibleEnd) return str;
  return maskChar.repeat(str.length - visibleEnd) + str.slice(-visibleEnd);
}
