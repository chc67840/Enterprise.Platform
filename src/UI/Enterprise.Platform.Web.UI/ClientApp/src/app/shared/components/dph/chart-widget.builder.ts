/**
 * ─── DPH UI KIT — CHART WIDGET BUILDERS ─────────────────────────────────────────
 *
 * Pure functions that translate `ChartWidgetConfig` + theme state into the
 * Chart.js `data` and `options` objects. Extracted from the component proper
 * so they can be unit-tested without TestBed (jsdom can't resolve Angular's
 * `styleUrl` cheaply, and the meat of the component is in these functions).
 *
 * THEME-AWARE REBUILD
 *   Chart.js bakes colors at chart construction. CSS variable changes do
 *   not trigger a chart re-render. The component's `themeRevision` signal
 *   bumps when `ThemeService.isDark()` flips and the option/data computeds
 *   re-invoke these functions, producing fresh colour assignments.
 *
 * COLOR RESOLUTION
 *   Every color value either comes from explicit `dataset.backgroundColor` /
 *   `dataset.borderColor`, or is auto-assigned from `CHART_PALETTE_TOKENS`
 *   resolved through the supplied `CssVarReader`.
 */
import {
  CHART_PALETTE_TOKENS,
  type ChartWidgetConfig,
  type ChartWidgetDataset,
  type CssVarReader,
} from './chart-widget.types';

/** Resolve a token name to a usable CSS color value, with a hex fallback. */
export function paletteColor(
  index: number,
  reader: CssVarReader,
  fallback = '#999999',
): string {
  const token = CHART_PALETTE_TOKENS[index % CHART_PALETTE_TOKENS.length];
  if (!token) return fallback;
  const value = reader(token).trim();
  return value || fallback;
}

/**
 * Lighten a CSS color (hex / hsl / rgb) by mixing it with white at the
 * given alpha. Returns the input unchanged for `'transparent'` and
 * already-translucent values. Used to derive `backgroundColor` for line
 * charts when a fill is requested but no explicit color is provided.
 */
function withAlpha(color: string, alpha: number): string {
  // Modern color-mix() is available in Chrome 111+ / Firefox 113+ / Safari 16.4+.
  // Chart.js 4.x consumes this fine because it ultimately hits canvas2D, which
  // resolves color-mix at paint time.
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/**
 * Build the Chart.js `data` object. Auto-assigns palette colors to any
 * dataset that doesn't supply explicit backgroundColor / borderColor.
 */
/** Resolved dataset shape — backgroundColor / borderColor narrowed to required, optional fields preserved. */
export type ResolvedChartDataset = Omit<ChartWidgetDataset, 'backgroundColor' | 'borderColor'> & {
  backgroundColor: string | readonly string[];
  borderColor: string;
  borderWidth: number;
};

export function buildChartData(
  config: ChartWidgetConfig,
  reader: CssVarReader,
): {
  labels: string[];
  datasets: ResolvedChartDataset[];
} {
  const isSegmented =
    config.type === 'pie' || config.type === 'doughnut' || config.type === 'polarArea';

  return {
    labels: [...config.labels],
    datasets: config.datasets.map((ds, i) => {
      const explicitBg = ds.backgroundColor;
      const explicitBorder = ds.borderColor;
      const baseColor = paletteColor(i, reader);

      // Segmented charts need ONE color per slice (per data point), not
      // per dataset. Map each label to a palette step.
      const backgroundColor: string | string[] = explicitBg
        ? explicitBg
        : isSegmented
          ? config.labels.map((_, idx) => paletteColor(idx, reader))
          : ds.fill === true
            ? withAlpha(baseColor, 0.18)
            : baseColor;

      const borderColor = explicitBorder ?? baseColor;

      return {
        ...ds,
        backgroundColor,
        borderColor,
        borderWidth: ds.type === 'line' || config.type === 'line' ? 2 : 1,
      };
    }),
  };
}

/**
 * Build the Chart.js `options` object. Theme-driven colors (axis text, grid
 * lines, legend labels) are resolved against the supplied reader so dark
 * mode rebuilds emit the right palette without component re-renders.
 *
 * `isDark` is passed alongside `reader` because some option choices flip
 * structurally (legend background opacity, grid line dash style) rather
 * than just by color.
 */
export function buildChartOptions(
  config: ChartWidgetConfig,
  isDark: boolean,
  reader: CssVarReader,
): Record<string, unknown> {
  const textColor = reader('--ep-text-secondary').trim() || (isDark ? '#cbd5e1' : '#334155');
  const gridColor = reader('--ep-border-subtle').trim() ||
    (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');
  const titleColor = reader('--ep-text-primary').trim() || (isDark ? '#f8fafc' : '#0f172a');

  const isCartesian =
    config.type === 'bar' || config.type === 'line' || config.type === 'radar';
  const isRadar = config.type === 'radar';

  const showLegend = config.showLegend ?? true;
  const legendPosition = config.legendPosition ?? 'bottom';

  const options: Record<string, unknown> = {
    responsive: true,
    maintainAspectRatio: config.maintainAspectRatio ?? false,
    aspectRatio: config.aspectRatio,
    plugins: {
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          color: textColor,
          usePointStyle: true,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.92)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: gridColor,
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        usePointStyle: true,
      },
    },
  };

  if (isCartesian && !isRadar) {
    options['scales'] = {
      x: {
        stacked: config.stacked ?? false,
        ticks: { color: textColor },
        grid: { color: gridColor, drawOnChartArea: false },
      },
      y: {
        stacked: config.stacked ?? false,
        beginAtZero: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    };
  }

  if (isRadar) {
    options['scales'] = {
      r: {
        ticks: { color: textColor, backdropColor: 'transparent' },
        grid: { color: gridColor },
        angleLines: { color: gridColor },
        pointLabels: { color: titleColor },
      },
    };
  }

  return options;
}
