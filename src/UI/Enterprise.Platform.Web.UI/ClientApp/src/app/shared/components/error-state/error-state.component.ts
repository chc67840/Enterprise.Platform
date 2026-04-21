/**
 * ─── ErrorStateComponent ────────────────────────────────────────────────────────
 *
 * The UI-block equivalent of the error-interceptor toast: an inline error
 * surface used INSIDE a feature view when the feature can't render (list
 * failed to load, detail couldn't fetch, etc.). Complements (not replaces)
 * the interceptor-level toast.
 *
 * USAGE
 *   ```html
 *   <app-error-state
 *     title="Couldn't load users"
 *     [message]="store.error()?.message"
 *     [correlationId]="store.error()?.correlationId"
 *     (retry)="store.loadAll()"
 *   />
 *   ```
 *
 * SEMANTICS
 *   - `role="alert"` + `aria-live="assertive"` — SR users are immediately
 *     told something has failed. Use assertive (not polite) because errors
 *     block the happy path.
 *   - Correlation id is rendered in a `<code>` block so support can pivot
 *     from the user's screenshot to the backend structured log.
 *
 * DESIGN
 *   - Red-tinged card, neutral typography.
 *   - Retry button is optional — emits a bound output only when the caller
 *     supplies a handler.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="alert"
      aria-live="assertive"
      class="flex flex-col items-start gap-3 rounded-ep-xl bg-danger-bg p-6 ring-1 ring-danger/20"
    >
      <div class="flex items-center gap-2 text-danger">
        <i class="pi pi-exclamation-circle text-xl" aria-hidden="true"></i>
        <h2 class="text-base font-semibold">{{ title() }}</h2>
      </div>
      @if (message()) {
        <p class="text-sm text-neutral-700">{{ message() }}</p>
      }
      @if (correlationId()) {
        <p class="text-xs text-neutral-500">
          Reference:
          <code class="rounded-ep-sm bg-neutral-100 px-1 font-mono">{{ correlationId() }}</code>
        </p>
      }
      <button
        type="button"
        class="mt-1 inline-flex items-center gap-1 rounded-ep-md bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 hover:bg-neutral-50"
        (click)="retry.emit()"
      >
        <i class="pi pi-refresh" aria-hidden="true"></i>
        Try again
      </button>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string | undefined>(undefined);
  /** Optional correlation id for support pivots. */
  readonly correlationId = input<string | undefined>(undefined);
  /** Emits when the user clicks "Try again". */
  readonly retry = output<void>();
}
