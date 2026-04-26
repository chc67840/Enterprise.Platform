/**
 * ─── ROUTER ERROR BOUNDARY ──────────────────────────────────────────────────────
 *
 * WHY
 *   Angular's `ErrorHandler` catches errors after they've bubbled out of
 *   change detection — by then the screen is already in an inconsistent
 *   state. This component lets a feature wrap its own outlet in a bounded
 *   region so render-time exceptions show a retry surface **in place** of
 *   the feature, not as a full-page redirect.
 *
 *   Pattern:
 *     <!-- in a feature's route container -->
 *     <app-router-error-boundary>
 *       <router-outlet />
 *     </app-router-error-boundary>
 *
 *   Global fallback (chunk-load, unknown fatals) still flows through
 *   `GlobalErrorHandlerService` → `/error/server-error`. This component is
 *   the finer-grained containment — the user's sidebar + nav stay intact
 *   while the affected feature area shows a retry button.
 *
 * HOW THE CAPTURE WORKS
 *   Angular 21 exposes `ErrorHandler` at the provider level: a component
 *   that provides its own `ErrorHandler` in `providers` intercepts errors
 *   thrown from any descendant view. We override locally, forward the error
 *   to telemetry (via the ambient root handler), and flip into an error
 *   state signal that drives the template.
 *
 *   The "Try again" button increments a `retryKey` signal that parents can
 *   bind to force the inner outlet to re-mount. Feature authors opt in by
 *   applying the boundary + binding the key as appropriate.
 *
 * NOTE
 *   This component is deliberately generic (no DomainContext) so it can
 *   wrap any feature's outlet without feature-specific wiring.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import { LoggerService } from '@core/services/logger.service';

/**
 * Local `ErrorHandler` that captures errors thrown inside the component
 * subtree and surfaces them as a signal. Kept as a provided class (not
 * providedIn: 'root') so each boundary instance has its own state.
 *
 * Phase 3 (2026-04-25) — telemetry forwarding removed; the BFF + .NET
 * backend own observability server-side. Error visibility on the client
 * comes via `LoggerService` (which writes to console + the structured
 * logging pipeline) and via the rendered fallback UI below.
 */
@Injectable()
export class BoundaryErrorHandler implements ErrorHandler {
  private readonly log = inject(LoggerService);

  private readonly _last = signal<unknown>(null);
  readonly last = this._last.asReadonly();

  handleError(error: unknown): void {
    this.log.error('route.boundary.caught', { error });
    this._last.set(error);
  }

  clear(): void {
    this._last.set(null);
  }
}

@Component({
  selector: 'app-router-error-boundary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    BoundaryErrorHandler,
    // Route descendant errors into our local handler instead of the global one.
    { provide: ErrorHandler, useExisting: BoundaryErrorHandler },
  ],
  template: `
    @if (hasError()) {
      <div
        class="rounded-xl bg-white p-6 text-center shadow ring-1 ring-red-100"
        role="alert"
        aria-live="assertive"
      >
        <h2 class="text-base font-semibold text-red-700">This section couldn't load</h2>
        <p class="mt-1 text-sm text-gray-600">
          {{ errorMessage() }}
        </p>
        <button
          type="button"
          class="mt-4 inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          (click)="retry()"
        >
          Try again
        </button>
      </div>
    } @else {
      <ng-content />
    }
  `,
})
export class RouterErrorBoundaryComponent {
  private readonly handler = inject(BoundaryErrorHandler);

  protected readonly hasError = computed(() => this.handler.last() !== null);
  protected readonly errorMessage = computed(() => {
    const err = this.handler.last();
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'An unexpected error occurred.';
  });

  protected retry(): void {
    // Clear the error state; the <ng-content /> re-projects, re-running the
    // inner outlet. Feature authors that need a forced re-mount of stateful
    // child components should key their outlet on a local retry counter.
    this.handler.clear();
  }
}
