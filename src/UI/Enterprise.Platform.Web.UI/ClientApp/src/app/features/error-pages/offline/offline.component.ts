/**
 * ─── OFFLINE (network) ──────────────────────────────────────────────────────────
 *
 * Shown when the app detects sustained network loss — used by a future
 * `navigator.onLine` observer (Phase 10 PWA path). For Phase 1 it exists as
 * a reachable route so the error interceptor can redirect here if desired
 * on status-code `0` failures.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-offline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 p-3 text-gray-500">
        <!-- prettier-ignore -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"/></svg>
      </div>
      <h1 class="text-xl font-semibold tracking-tight text-gray-900">You're offline</h1>
      <p class="mt-2 text-sm text-gray-600">
        We can't reach the server right now. Check your internet connection and try again.
      </p>
      <button
        type="button"
        class="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        (click)="retry()"
      >
        Retry
      </button>
    </div>
  `,
})
export class OfflineComponent {
  protected retry(): void {
    window.location.reload();
  }
}
