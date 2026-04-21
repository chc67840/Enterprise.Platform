/**
 * ─── LoadingOverlayComponent ────────────────────────────────────────────────────
 *
 * A translucent spinner overlay used by feature views while a slow operation
 * blocks the surface (initial data load, submit-in-progress). For lightweight
 * pagination / TTL refreshes, prefer skeletons (SkeletonCardComponent).
 *
 * USAGE
 *   ```html
 *   <div class="relative">
 *     <table> ... </table>
 *     @if (store.loading()) {
 *       <app-loading-overlay message="Loading users" />
 *     }
 *   </div>
 *   ```
 *
 * The host container must have `position: relative` so the overlay anchors
 * correctly.
 *
 * SEMANTICS
 *   - `role="status"` + `aria-live="polite"` — announces "Loading ..." to SR
 *     users without interrupting them.
 *   - `aria-busy="true"` on the overlay so assistive tech knows the region
 *     is in a transient state.
 *   - When inside a container with `[aria-busy]`, content underneath is
 *     implicitly flagged as non-interactive.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      class="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm"
    >
      <i
        class="pi pi-spin pi-spinner text-3xl text-primary-600"
        aria-hidden="true"
      ></i>
      @if (message()) {
        <p class="text-sm font-medium text-neutral-700">{{ message() }}</p>
      }
      <span class="sr-only">{{ message() ?? 'Loading' }}</span>
    </div>
  `,
})
export class LoadingOverlayComponent {
  /** Optional visible label; defaults to a silent "Loading" for screen readers. */
  readonly message = input<string | undefined>(undefined);
}
