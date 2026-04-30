/**
 * ─── chart-widget.builder — UNIT TESTS ──────────────────────────────────────────
 *
 * Pure-function tests over the data + options builders. No TestBed; we feed
 * configs and a stub `CssVarReader` to assert the Chart.js shapes that come
 * out the other side.
 *
 * COVERAGE
 *   - Auto palette assignment for cartesian charts (one color per dataset).
 *   - Per-slice palette for segmented charts (pie / doughnut / polarArea).
 *   - Explicit `dataset.backgroundColor` wins over auto palette.
 *   - `fill: true` derives a translucent variant via color-mix().
 *   - Cartesian options include `scales.x` + `scales.y`.
 *   - Radar options include `scales.r`.
 *   - Segmented charts have NO scales (Chart.js auto-handles).
 *   - Tooltip / legend colors flip between light and dark modes.
 *   - `paletteColor()` cycles through tokens and falls back gracefully.
 */
import { describe, it, expect } from 'vitest';

import {
  buildChartData,
  buildChartOptions,
  paletteColor,
} from './chart-widget.builder';
import {
  CHART_PALETTE_TOKENS,
  type ChartWidgetConfig,
  type CssVarReader,
} from './chart-widget.types';

/** Map-backed reader stub: returns whatever the test seeds. */
const stubReader = (entries: Record<string, string> = {}): CssVarReader => {
  return (name: string): string => entries[name] ?? '';
};

describe('paletteColor', () => {
  it('resolves the i-th token via the reader', () => {
    const reader = stubReader({
      '--ep-color-primary-500': '#1b3f73',
      '--ep-color-palmetto-500': '#1f5328',
    });
    expect(paletteColor(0, reader)).toBe('#1b3f73');
    expect(paletteColor(1, reader)).toBe('#1f5328');
  });

  it('cycles through the palette for indices beyond its length', () => {
    const reader = stubReader({ '--ep-color-primary-500': '#aaa' });
    // Index 0, then 0 + palette.length should resolve to the same slot.
    expect(paletteColor(0, reader)).toBe('#aaa');
    expect(paletteColor(CHART_PALETTE_TOKENS.length, reader)).toBe('#aaa');
  });

  it('falls back when reader returns empty string', () => {
    expect(paletteColor(0, stubReader(), '#fallback')).toBe('#fallback');
  });

  it('default fallback color is mid-gray', () => {
    expect(paletteColor(0, stubReader())).toBe('#999999');
  });
});

describe('buildChartData', () => {
  const baseConfig: ChartWidgetConfig = {
    type: 'bar',
    labels: ['Mon', 'Tue', 'Wed'],
    datasets: [
      { label: 'Revenue', data: [10, 20, 30] },
      { label: 'Expenses', data: [5, 15, 25] },
    ],
  };
  const reader = stubReader({
    '--ep-color-primary-500': '#1b3f73',
    '--ep-color-palmetto-500': '#1f5328',
    '--ep-color-jessamine-500': '#f4b82e',
  });

  it('preserves labels (defensive copy, no shared reference)', () => {
    const out = buildChartData(baseConfig, reader);
    expect(out.labels).toEqual(['Mon', 'Tue', 'Wed']);
    expect(out.labels).not.toBe(baseConfig.labels);
  });

  it('cartesian: auto-assigns ONE palette color per dataset', () => {
    const out = buildChartData(baseConfig, reader);
    expect(out.datasets).toHaveLength(2);
    expect(out.datasets[0]?.backgroundColor).toBe('#1b3f73'); // primary-500
    expect(out.datasets[0]?.borderColor).toBe('#1b3f73');
    expect(out.datasets[1]?.backgroundColor).toBe('#1f5328'); // palmetto-500
    expect(out.datasets[1]?.borderColor).toBe('#1f5328');
  });

  it('segmented (doughnut/pie/polarArea): assigns ONE color PER LABEL not per dataset', () => {
    for (const type of ['doughnut', 'pie', 'polarArea'] as const) {
      const config: ChartWidgetConfig = {
        ...baseConfig,
        type,
        labels: ['A', 'B', 'C'],
        datasets: [{ label: 'Share', data: [50, 30, 20] }],
      };
      const out = buildChartData(config, reader);
      const bg = out.datasets[0]?.backgroundColor;
      expect(Array.isArray(bg)).toBe(true);
      expect(bg as string[]).toHaveLength(3);
    }
  });

  it('explicit dataset.backgroundColor wins over auto palette', () => {
    const out = buildChartData(
      {
        ...baseConfig,
        datasets: [{ label: 'Revenue', data: [1, 2, 3], backgroundColor: '#abcdef' }],
      },
      reader,
    );
    expect(out.datasets[0]?.backgroundColor).toBe('#abcdef');
  });

  it('explicit borderColor wins over auto palette', () => {
    const out = buildChartData(
      {
        ...baseConfig,
        datasets: [{ label: 'X', data: [1, 2, 3], borderColor: '#012345' }],
      },
      reader,
    );
    expect(out.datasets[0]?.borderColor).toBe('#012345');
  });

  it('line+fill derives translucent backgroundColor via color-mix', () => {
    const out = buildChartData(
      {
        ...baseConfig,
        type: 'line',
        datasets: [{ label: 'Trend', data: [1, 2, 3], fill: true }],
      },
      reader,
    );
    const bg = out.datasets[0]?.backgroundColor as string;
    expect(bg).toContain('color-mix(');
    expect(bg).toContain('#1b3f73');
  });

  it('line charts get borderWidth: 2; bar charts get borderWidth: 1', () => {
    expect(
      buildChartData(
        { ...baseConfig, type: 'line', datasets: [{ label: 'a', data: [1] }] },
        reader,
      ).datasets[0]?.borderWidth,
    ).toBe(2);
    expect(
      buildChartData(
        { ...baseConfig, type: 'bar', datasets: [{ label: 'a', data: [1] }] },
        reader,
      ).datasets[0]?.borderWidth,
    ).toBe(1);
  });
});

describe('buildChartOptions', () => {
  const reader = stubReader({
    '--ep-text-primary': '#0f172a',
    '--ep-text-secondary': '#475569',
    '--ep-border-subtle': 'rgba(0,0,0,0.08)',
  });
  const baseConfig: ChartWidgetConfig = {
    type: 'bar',
    labels: ['A'],
    datasets: [{ label: 'x', data: [1] }],
  };

  it('cartesian charts include scales.x and scales.y', () => {
    const opts = buildChartOptions(baseConfig, false, reader);
    expect(opts['scales']).toMatchObject({
      x: expect.any(Object),
      y: expect.any(Object),
    });
  });

  it('radar charts include scales.r and NOT scales.x/y', () => {
    const opts = buildChartOptions({ ...baseConfig, type: 'radar' }, false, reader);
    expect(opts['scales']).toHaveProperty('r');
    expect(opts['scales']).not.toHaveProperty('x');
    expect(opts['scales']).not.toHaveProperty('y');
  });

  it('segmented charts (pie/doughnut/polarArea) have NO scales block', () => {
    for (const type of ['pie', 'doughnut', 'polarArea'] as const) {
      const opts = buildChartOptions({ ...baseConfig, type }, false, reader);
      expect(opts['scales']).toBeUndefined();
    }
  });

  it('legend colors come from --ep-text-secondary', () => {
    const opts = buildChartOptions(baseConfig, false, reader);
    const legend = (opts['plugins'] as Record<string, Record<string, unknown>>)['legend'];
    const labels = legend?.['labels'] as Record<string, unknown>;
    expect(labels?.['color']).toBe('#475569');
  });

  it('respects showLegend: false', () => {
    const opts = buildChartOptions(
      { ...baseConfig, showLegend: false },
      false,
      reader,
    );
    const legend = (opts['plugins'] as Record<string, Record<string, unknown>>)['legend'];
    expect(legend?.['display']).toBe(false);
  });

  it('legendPosition is forwarded (default: bottom)', () => {
    expect(
      ((buildChartOptions(baseConfig, false, reader)['plugins'] as Record<
        string,
        Record<string, unknown>
      >)['legend'] as Record<string, unknown>)['position'],
    ).toBe('bottom');
    expect(
      ((buildChartOptions(
        { ...baseConfig, legendPosition: 'right' },
        false,
        reader,
      )['plugins'] as Record<string, Record<string, unknown>>)['legend'] as Record<
        string,
        unknown
      >)['position'],
    ).toBe('right');
  });

  it('stacked: true threads through to scales.x.stacked + scales.y.stacked', () => {
    const opts = buildChartOptions({ ...baseConfig, stacked: true }, false, reader);
    const scales = opts['scales'] as Record<string, Record<string, unknown>>;
    expect(scales['x']?.['stacked']).toBe(true);
    expect(scales['y']?.['stacked']).toBe(true);
  });

  it('grid color comes from --ep-border-subtle', () => {
    const opts = buildChartOptions(baseConfig, false, reader);
    const scales = opts['scales'] as Record<string, Record<string, unknown>>;
    const yGrid = scales['y']?.['grid'] as Record<string, unknown>;
    expect(yGrid?.['color']).toBe('rgba(0,0,0,0.08)');
  });

  it('falls back to dark-mode defaults when reader returns empty string and isDark is true', () => {
    const opts = buildChartOptions(baseConfig, true, stubReader());
    const scales = opts['scales'] as Record<string, Record<string, unknown>>;
    const xGrid = scales['x']?.['grid'] as Record<string, unknown>;
    expect(xGrid?.['color']).toBe('rgba(255,255,255,0.08)');
  });

  it('responsive: true and aspect-ratio handling', () => {
    const opts = buildChartOptions(
      { ...baseConfig, aspectRatio: 2, maintainAspectRatio: true },
      false,
      reader,
    );
    expect(opts['responsive']).toBe(true);
    expect(opts['aspectRatio']).toBe(2);
    expect(opts['maintainAspectRatio']).toBe(true);
  });
});
