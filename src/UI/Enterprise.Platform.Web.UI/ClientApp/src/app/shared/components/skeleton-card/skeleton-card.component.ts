/**
 * ─── SkeletonCardComponent ──────────────────────────────────────────────────────
 *
 * Shimmering placeholder block rendered while list / card data is loading.
 * Replaces the bigger full-screen `LoadingOverlayComponent` for the common
 * "refreshing this grid" case — keeps layout stable so the page doesn't
 * reflow when the real content arrives.
 *
 * VARIANTS
 *   - `card`      — single block with heading + two text lines.
 *   - `list-row`  — a single horizontal row with avatar + lines.
 *   - `table-row` — a full-width horizontal strip (use repeated in tables).
 *   - `chart`     — larger square block suitable behind a chart.
 *   - `stat-card` — KPI-card shape (value + label).
 *
 * USAGE
 *   ```html
 *   @if (store.loading()) {
 *     @for (_ of [1,2,3,4]; track $index) {
 *       <app-skeleton-card variant="list-row" />
 *     }
 *   }
 *   ```
 *
 * SEMANTICS
 *   `aria-hidden="true"` — skeletons are purely decorative; the actual
 *   loading announcement comes from the GlobalProgressBar / LoadingOverlay.
 *
 * MOTION
 *   Uses the `ep-shimmer` keyframes from `animations.css`. The
 *   `prefers-reduced-motion: reduce` safeguard there turns the shimmer into
 *   a static gradient.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'card' | 'list-row' | 'table-row' | 'chart' | 'stat-card';

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './skeleton-card.component.scss',
  template: `
    <div aria-hidden="true" class="w-full">
      @switch (variant()) {
        @case ('card') {
          <div class="rounded-ep-xl bg-white p-4 ring-1 ring-neutral-200">
            <div class="ep-skeleton mb-3 h-5 w-1/3"></div>
            <div class="ep-skeleton mb-2 h-4 w-4/5"></div>
            <div class="ep-skeleton h-4 w-3/5"></div>
          </div>
        }
        @case ('list-row') {
          <div class="flex items-center gap-3 rounded-ep-md p-2">
            <div class="ep-skeleton h-10 w-10 rounded-full"></div>
            <div class="flex-1">
              <div class="ep-skeleton mb-2 h-4 w-1/3"></div>
              <div class="ep-skeleton h-3 w-1/2"></div>
            </div>
          </div>
        }
        @case ('table-row') {
          <div class="flex items-center gap-4 border-b border-neutral-100 py-3">
            <div class="ep-skeleton h-4 w-1/5"></div>
            <div class="ep-skeleton h-4 w-1/4"></div>
            <div class="ep-skeleton h-4 w-1/6"></div>
            <div class="ep-skeleton ml-auto h-4 w-16"></div>
          </div>
        }
        @case ('chart') {
          <div class="ep-skeleton h-64 w-full"></div>
        }
        @case ('stat-card') {
          <div class="rounded-ep-xl bg-white p-4 ring-1 ring-neutral-200">
            <div class="ep-skeleton mb-3 h-3 w-1/3"></div>
            <div class="ep-skeleton h-7 w-1/2"></div>
          </div>
        }
      }
    </div>
  `,
})
export class SkeletonCardComponent {
  readonly variant = input<SkeletonVariant>('card');
  /** Placeholder — currently unused but reserved for grouping-by-height. */
  protected readonly _size = computed(() => this.variant());
}
