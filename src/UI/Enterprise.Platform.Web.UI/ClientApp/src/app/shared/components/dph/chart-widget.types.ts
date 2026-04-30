/**
 * ─── DPH UI KIT — CHART WIDGET TYPES ────────────────────────────────────────────
 *
 * Type contract for `<dph-chart-widget>`. Lives separately from the component
 * so the option-builder pure function (`buildChartOptions`) can be unit-tested
 * without bootstrapping Angular's TestBed.
 *
 * SUPPORTED TYPES
 *   The 6 Chart.js types we wrap. Mixed-type charts (per-dataset `type`
 *   override) are supported when `config.type` is `'bar'` or `'line'` — the
 *   per-dataset `type` field overrides on a row-by-row basis.
 *
 * COLOR STRATEGY
 *   The widget reads CSS custom properties at runtime via `getComputedStyle`
 *   so dark-mode flips (which only swap `--ep-*` tokens, not Chart.js state)
 *   re-skin the chart without re-rendering from the host.
 */

/** Chart.js type names we wrap. */
export type ChartWidgetType =
  | 'bar'
  | 'line'
  | 'doughnut'
  | 'pie'
  | 'radar'
  | 'polarArea';

/**
 * Per-dataset configuration. Most fields map 1:1 to Chart.js dataset
 * options; we narrow the type so callers don't pass nonsense.
 */
export interface ChartWidgetDataset {
  readonly label: string;
  readonly data: readonly number[];
  /** Per-row override — `bar` chart can mix `line` rows for combo display. */
  readonly type?: 'bar' | 'line';
  /** Override the auto-assigned palette color. CSS var refs allowed. */
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly fill?: boolean;
  readonly tension?: number;
  /** Multi-axis charts: bind to a Y-axis id declared in `config.scales`. */
  readonly yAxisID?: string;
}

export interface ChartWidgetConfig {
  readonly type: ChartWidgetType;
  readonly title?: string;
  readonly subtitle?: string;
  readonly labels: readonly string[];
  readonly datasets: readonly ChartWidgetDataset[];
  /** Pixel height; defaults to '300px'. */
  readonly height?: string;
  readonly showLegend?: boolean;
  /** Position of the legend when `showLegend: true`. */
  readonly legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  /** Stack bar/line charts on the X axis. */
  readonly stacked?: boolean;
  /** Aspect ratio override (Chart.js `aspectRatio`). */
  readonly aspectRatio?: number;
  /**
   * If `true`, the chart fills its container without preserving aspect
   * ratio. The default is `true` because charts in cards usually want to
   * span full width of the card regardless of intrinsic aspect.
   */
  readonly maintainAspectRatio?: boolean;
}

/**
 * Minimal getCssVar accessor — extracted as a parameter so the pure
 * `buildChartOptions` can be tested with a stub. The component supplies a
 * `getComputedStyle`-backed implementation; tests pass a `Map`-backed stub.
 */
export type CssVarReader = (name: string) => string;

/**
 * Default 8-color palette keyed off the platform's brand tokens. Tests
 * verify the order is stable; production code reads via CssVarReader so
 * runtime values mirror the resolved tokens (including dark-mode flips).
 *
 * The `--ep-` token name (without the leading `--`) is what callers
 * reference here. `paletteColor()` resolves them at runtime.
 */
export const CHART_PALETTE_TOKENS: readonly string[] = [
  '--ep-color-primary-500',
  '--ep-color-palmetto-500',
  '--ep-color-jessamine-500',
  '--ep-color-primary-700',
  '--ep-color-palmetto-700',
  '--ep-color-jessamine-700',
  '--ep-color-primary-300',
  '--ep-color-palmetto-300',
];
