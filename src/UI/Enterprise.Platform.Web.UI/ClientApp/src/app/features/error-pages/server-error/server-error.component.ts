/**
 * ─── SERVER ERROR (500) ─────────────────────────────────────────────────────────
 *
 * Shown when `GlobalErrorHandlerService` (Phase 3) catches a fatal
 * application error — typically a chunk-load failure, an unhandled exception
 * inside change detection, or a repeated 5xx the retry interceptor couldn't
 * recover from.
 *
 * The "Try again" button reloads the app rather than router.navigate — the
 * former guarantees a fresh bundle (important for chunk-load recovery).
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-server-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 p-3 text-amber-600">
        <!-- prettier-ignore -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
      </div>
      <h1 class="text-xl font-semibold tracking-tight text-gray-900">Something went wrong</h1>
      <p class="mt-2 text-sm text-gray-600">
        The app ran into an unexpected problem. Our team has been notified.
      </p>
      <div class="mt-6 flex justify-center gap-3">
        <button
          type="button"
          class="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          (click)="reload()"
        >
          Try again
        </button>
        <a
          routerLink="/"
          class="inline-flex rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Return home
        </a>
      </div>
    </div>
  `,
})
export class ServerErrorComponent {
  protected reload(): void {
    // Full reload — recovers from stale-chunk / poisoned-state scenarios.
    window.location.reload();
  }
}
