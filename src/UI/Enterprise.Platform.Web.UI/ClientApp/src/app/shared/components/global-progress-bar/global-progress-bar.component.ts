/**
 * ─── GlobalProgressBarComponent ─────────────────────────────────────────────────
 *
 * Thin app-wide progress indicator at the top of the viewport. Driven by
 * `LoadingService.isLoading()` (counter-based) so it appears as soon as ANY
 * request is in flight and disappears when the last one completes. Distinct
 * from `LoadingOverlayComponent`, which is scoped to a specific view.
 *
 * USAGE
 *   Mounted once in `AppShellComponent`:
 *   ```html
 *   <app-global-progress-bar />
 *   ```
 *
 * ANIMATION
 *   Indeterminate sweeping bar — `ep-progress-indeterminate` keyframes in
 *   `_animations.scss`. The bar element itself is `aria-hidden` because SR
 *   users should not be told about every network request; instead we emit
 *   a single polite live-region message when the state toggles.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LoadingService } from '@core/services/loading.service';

@Component({
  selector: 'app-global-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading.isLoading()) {
      <!--
        Fixed strip at the very top of the viewport. The sweeping highlight is
        animated via keyframes in _animations.scss. Reduced-motion users see a
        static bar (no sweep) thanks to the global @media override.
      -->
      <div
        class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary-100"
        aria-hidden="true"
      >
        <div
          class="absolute top-0 h-full bg-primary-600"
          style="animation: ep-progress-indeterminate 1.5s infinite var(--ep-ease-standard)"
        ></div>
      </div>

      <!-- Single polite live-region message so SR users know background
           activity is happening, without announcing every request. -->
      <span class="sr-only" role="status" aria-live="polite">Loading</span>
    }
  `,
})
export class GlobalProgressBarComponent {
  readonly loading = inject(LoadingService);
}
