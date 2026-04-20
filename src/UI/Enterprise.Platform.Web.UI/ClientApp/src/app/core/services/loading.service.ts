/**
 * ─── LOADING SERVICE ────────────────────────────────────────────────────────────
 *
 * WHY
 *   A single app-wide counter of in-flight HTTP requests, exposed as a signal.
 *   Drives the top-of-viewport `GlobalProgressBarComponent` (Phase 5) and
 *   powers the "are we loading anything?" check used in a11y live regions.
 *
 * HOW IT'S USED
 *   - `loadingInterceptor` increments on request start, decrements on
 *     completion (success OR error) — the counter is balanced.
 *   - Components read `isLoading()` (signal) to show / hide chrome.
 *   - Requests that don't want to drive the global indicator (e.g. silent
 *     background polls) set the `X-Skip-Loading` header, which the
 *     interceptor strips before sending.
 *
 * WHY A COUNTER (not a boolean)
 *   Multiple concurrent requests are the norm. A boolean flips off the moment
 *   any one request completes — the UX would flicker. A counter stays
 *   `> 0` until the LAST request in the batch finishes.
 *
 * DESIGN NOTES
 *   - `inc` / `dec` are the only mutators. Components never flip the counter
 *     directly; interceptors own it.
 *   - `isLoading` is a computed signal — templates bind to it with zero
 *     ceremony and get proper change-detection behaviour in zoneless mode.
 */
import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  /** In-flight HTTP request count. Never negative; defensive clamp in `dec()`. */
  private readonly count = signal(0);

  /**
   * True iff at least one request is in flight. Components bind to this signal
   * in templates (`@if (loading.isLoading())`) and get auto-update in zoneless mode.
   */
  readonly isLoading = computed(() => this.count() > 0);

  /** Current in-flight count — useful for diagnostics / devtools. */
  readonly inFlight = this.count.asReadonly();

  /** Called by the HTTP interceptor on request start. */
  inc(): void {
    this.count.update((n) => n + 1);
  }

  /**
   * Called by the HTTP interceptor on request completion (success or failure).
   * Defensively clamped at 0 so a bug in the interceptor can't drive the counter
   * negative and silently disable the loading UI.
   */
  dec(): void {
    this.count.update((n) => (n > 0 ? n - 1 : 0));
  }
}
