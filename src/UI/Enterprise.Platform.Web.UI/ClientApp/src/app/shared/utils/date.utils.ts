/**
 * ─── shared/utils/date ──────────────────────────────────────────────────────────
 *
 * Date/time helpers built on Intl + native Date — no moment/date-fns
 * dependency. Centralized so future feature pages (maintenance banner
 * countdown, "last login N ago", trial-expiry timer) all use the same
 * formatting behavior.
 */

/** True when the given epoch-ms timestamp is in the past. */
export function isExpired(expiryTimestampMs: number): boolean {
  return Date.now() >= expiryTimestampMs;
}

/** New Date offset by `minutes`. Negative values are allowed. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Countdown string — `Xh Ym` for >1h remaining, `Xm Ys` for <1h, `Xs`
 * for <1m. Clamps to `0s` when the target is in the past (no negative
 * values bleeding into the UI).
 *
 * Used by maintenance-window countdowns, session-expiring dialogs, and
 * any "you have X time left" affordance.
 */
export function formatCountdown(targetMs: number): string {
  const diffMs = Math.max(0, targetMs - Date.now());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Locale-aware relative time — "5 minutes ago", "in 2 hours", "yesterday".
 * Uses `Intl.RelativeTimeFormat` so the wording matches the active locale.
 */
export function toRelativeTime(date: Date, locale: string | undefined = undefined): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  return rtf.format(diffDay, 'day');
}
