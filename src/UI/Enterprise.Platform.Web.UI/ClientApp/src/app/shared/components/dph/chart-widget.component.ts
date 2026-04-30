/**
 * ─── DPH UI KIT — CHART WIDGET ──────────────────────────────────────────────────
 *
 * Theme-aware Chart.js wrapper. Supports 6 chart types (bar / line / doughnut
 * / pie / radar / polarArea) plus mixed bar+line combo charts via per-dataset
 * `type` overrides.
 *
 *   <dph-chart-widget [config]="dashboardConfig()" [loading]="loading()" />
 *
 * THEME-AWARE REBUILD (the load-bearing trick)
 *   Chart.js bakes colors into the chart instance at construction. CSS
 *   variable changes (like the `:root.dark` token swap when the user
 *   toggles dark mode) DO NOT trigger a chart re-render. Without this
 *   fix, axis labels stay in the previous theme's color until a manual
 *   reload.
 *
 *   The fix: a `themeRevision = signal(0)` is bumped from an effect
 *   watching `ThemeService.isDark()`. The data + options computeds both
 *   read `themeRevision()`, so they re-invoke the pure builder functions
 *   on every theme flip — producing fresh option objects with the new
 *   token-resolved colors.
 *
 *   The signal write is wrapped in `untracked()` so the effect doesn't
 *   self-trigger (per `feedback_signal_effect_self_write_loop` memory).
 *
 * COLOR ARCHITECTURE
 *   Colors come from `CHART_PALETTE_TOKENS` in chart-widget.types.ts —
 *   a list of `--ep-*` token names. The component reads them via
 *   `getComputedStyle(documentElement).getPropertyValue(token)` so the
 *   resolved values reflect the current theme (light or dark variant of
 *   the brand palette).
 *
 *   Tests stub the reader with a Map so they don't depend on a DOM.
 *
 * LOADING STATE
 *   `[loading]="true"` shows a `<p-skeleton>` of the configured height
 *   instead of the chart. No empty-state — empty datasets still render
 *   the chart's empty grid (Chart.js handles this gracefully).
 */
import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';

import { ThemeService } from '@core/services/theme.service';

import {
  buildChartData,
  buildChartOptions,
} from './chart-widget.builder';
import type {
  ChartWidgetConfig,
  CssVarReader,
} from './chart-widget.types';

@Component({
  selector: 'dph-chart-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartModule, SkeletonModule],
  template: `
    <div class="dph-chart-widget">
      @if (config().title) {
        <h3 class="dph-chart-widget__title">{{ config().title }}</h3>
      }
      @if (config().subtitle) {
        <p class="dph-chart-widget__subtitle">{{ config().subtitle }}</p>
      }

      <div class="dph-chart-widget__canvas" [style.height]="config().height ?? '300px'">
        @if (loading()) {
          <p-skeleton width="100%" [height]="config().height ?? '300px'" />
        } @else {
          <p-chart
            [type]="config().type"
            [data]="chartData()"
            [options]="chartOptions()"
            [height]="config().height ?? '300px'"
          />
        }
      </div>
    </div>
  `,
  styleUrl: './chart-widget.component.scss',
})
export class ChartWidgetComponent {
  readonly config = input.required<ChartWidgetConfig>();
  readonly loading = input<boolean>(false);

  private readonly theme = inject(ThemeService);
  private readonly doc = inject(DOCUMENT);

  /**
   * Bumped from the theme-watcher effect on every dark-mode flip. Read by
   * `chartData` and `chartOptions` so they re-evaluate the pure builder
   * functions and pick up the new token-resolved colors.
   */
  private readonly themeRevision = signal(0);

  /**
   * Watch `theme.isDark()` and increment `themeRevision`. The write is
   * wrapped in `untracked()` so the effect does not self-trigger; the
   * signal-effect-self-write trap in this codebase is documented in
   * `feedback_signal_effect_self_write_loop.md`.
   */
  private readonly _themeWatcher = effect(() => {
    this.theme.isDark(); // dependency
    untracked(() => this.themeRevision.update((n) => n + 1));
  });

  /**
   * Reader closes over `this.doc.documentElement`. Tests inject a stub
   * via the protected accessor below, so this default path is not on
   * the unit-test hot path — only used in real DOM rendering.
   */
  private readonly reader: CssVarReader = (name: string): string => {
    const root = this.doc.documentElement;
    if (!root) return '';
    return getComputedStyle(root).getPropertyValue(name);
  };

  protected readonly chartData = computed(() => {
    this.themeRevision(); // re-run on theme flip
    return buildChartData(this.config(), this.reader);
  });

  protected readonly chartOptions = computed(() => {
    this.themeRevision();
    return buildChartOptions(this.config(), this.theme.isDark(), this.reader);
  });
}
