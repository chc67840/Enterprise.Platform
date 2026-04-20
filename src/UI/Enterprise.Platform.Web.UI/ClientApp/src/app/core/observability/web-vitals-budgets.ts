/**
 * ─── WEB-VITALS BUDGETS ─────────────────────────────────────────────────────────
 *
 * WHY
 *   Publishing budgets next to the metric tag lets dashboards and alerting
 *   rules answer "is this page healthy?" without re-deriving thresholds from
 *   RUM data. Values match Google's "good" thresholds as of 2026-Q1; tighten
 *   (not loosen) if product requirements demand higher quality.
 *
 * HOW IT'S USED
 *   `TelemetryService` stamps `withinBudget: boolean` on every web-vitals
 *   custom metric. Backend dashboards filter on the flag to isolate bad
 *   sessions and alert on regression.
 *
 * UNITS
 *   - LCP / FCP / TTFB are milliseconds (web-vitals v5 reports ms).
 *   - INP is milliseconds.
 *   - CLS is a unitless layout-shift score.
 */
export const WEB_VITALS_BUDGETS = {
  /** Largest Contentful Paint — user-perceived load time. */
  LCP_MS: 2_500,
  /** Interaction to Next Paint — responsiveness under interaction. */
  INP_MS: 200,
  /** Cumulative Layout Shift — visual stability. */
  CLS: 0.1,
  /** First Contentful Paint — "something is on screen". Complementary to LCP. */
  FCP_MS: 1_800,
  /** Time to First Byte — server response latency budget. */
  TTFB_MS: 800,
} as const;

/** Returns `true` when the metric value is within its budget (lower is better). */
export function isWithinBudget(name: WebVitalName, value: number): boolean {
  switch (name) {
    case 'LCP':
      return value <= WEB_VITALS_BUDGETS.LCP_MS;
    case 'INP':
      return value <= WEB_VITALS_BUDGETS.INP_MS;
    case 'CLS':
      return value <= WEB_VITALS_BUDGETS.CLS;
    case 'FCP':
      return value <= WEB_VITALS_BUDGETS.FCP_MS;
    case 'TTFB':
      return value <= WEB_VITALS_BUDGETS.TTFB_MS;
    default:
      // Unknown vitals shouldn't reach us — if they do, treat as in-budget.
      return true;
  }
}

/** Names reported by the `web-vitals` package. */
export type WebVitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
