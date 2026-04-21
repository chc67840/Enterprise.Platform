/**
 * ─── EmptyStateComponent ────────────────────────────────────────────────────────
 *
 * Shown when a list / search / detail view has zero rows and no error. Gives
 * the user a friendly "nothing here yet" explanation + an optional CTA
 * (create first entity, clear filters, etc.).
 *
 * USAGE
 *   ```html
 *   <app-empty-state
 *     icon="pi-inbox"
 *     title="No users yet"
 *     message="Create your first user to get started."
 *   >
 *     <button pButton label="New user" (click)="create()"></button>
 *   </app-empty-state>
 *   ```
 *
 * SEMANTICS
 *   Uses `role="status"` + `aria-live="polite"` so SR users are informed
 *   when the empty state appears (e.g. after a search that returns nothing)
 *   without interrupting their current action.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="status"
      aria-live="polite"
      class="flex flex-col items-center justify-center rounded-ep-xl bg-neutral-50 px-6 py-12 text-center"
    >
      @if (icon()) {
        <i
          class="pi {{ icon() }} mb-3 text-4xl text-neutral-400"
          aria-hidden="true"
        ></i>
      }
      <h2 class="text-lg font-semibold text-neutral-800">{{ title() }}</h2>
      @if (message()) {
        <p class="mt-1 max-w-prose text-sm text-neutral-500">{{ message() }}</p>
      }
      <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  /** Optional PrimeIcons class name (e.g. `pi-inbox`, `pi-search`). */
  readonly icon = input<string | undefined>(undefined);

  /** Required title — a short friendly phrase. */
  readonly title = input.required<string>();

  /** Optional supporting sentence. */
  readonly message = input<string | undefined>(undefined);
}
