/**
 * ─── shared/utils/number ────────────────────────────────────────────────────────
 *
 * Locale-aware number formatting + math helpers. All formatters use the
 * platform `Intl.NumberFormat` so they respect the active locale (set
 * globally via `LOCALE_ID` provider in app.config.ts).
 */

/**
 * Locale-aware currency string. Default `USD` + `en-US` matches our
 * platform default LOCALE_ID. Pass an explicit currency code for any
 * non-USD value (`'EUR'`, `'GBP'`, `'INR'`...).
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale: string | undefined = undefined,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Compact human-readable number — `1.2K`, `3.4M`, `1.5B`. For dashboards
 * + KPI tiles where exact precision is noise. Negative values supported.
 */
export function abbreviateNumber(value: number, fractionDigits = 1): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(fractionDigits)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(fractionDigits)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(fractionDigits)}K`;
  }
  return value.toString();
}

/**
 * Locale-aware percentage. `value` is the raw percentage (e.g. `42` for 42%),
 * NOT a 0-1 ratio. Use ratio division at the call-site if your data is 0-1.
 */
export function formatPercentage(
  value: number,
  decimals = 0,
  locale: string | undefined = undefined,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/** Constrains `value` to the `[min, max]` range. Returns `min` when min > max. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

/** Round to a fixed decimal count without `toFixed`'s string round-trip. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
