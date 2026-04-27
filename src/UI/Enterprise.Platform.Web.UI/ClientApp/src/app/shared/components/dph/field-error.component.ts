/**
 * ─── DPH UI KIT — FIELD ERROR ───────────────────────────────────────────────────
 *
 * Standardized inline error display for form fields. Used by `dph-input`
 * internally; also available standalone for custom controls.
 *
 *   <dph-field-error
 *     [errors]="['Email is required', 'Email must be valid']"
 *     [touched]="emailControl.touched"
 *     id="email-error"
 *   />
 *
 * The host element exposes `id` so it can be referenced from the input's
 * `aria-describedby` attribute.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'dph-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleErrors().length > 0) {
      <div
        class="dph-field-error"
        [attr.id]="id() || null"
        role="alert"
        aria-live="polite"
      >
        @if (icon()) {
          <i class="pi pi-exclamation-circle dph-field-error__icon" aria-hidden="true"></i>
        }
        @if (visibleErrors().length === 1) {
          <span>{{ visibleErrors()[0] }}</span>
        } @else {
          <ul class="dph-field-error__list">
            @for (e of visibleErrors(); track e) {
              <li>{{ e }}</li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .dph-field-error {
        display: flex;
        align-items: flex-start;
        gap: 0.375rem;
        margin-top: 0.25rem;
        font-size: 0.75rem;
        line-height: 1.25;
        color: var(--ep-color-danger-700);
        animation: dph-field-error-in 200ms ease forwards;
      }
      .dph-field-error__icon {
        margin-top: 0.0625rem;
        font-size: 0.8125rem;
      }
      .dph-field-error__list {
        list-style: disc;
        margin: 0;
        padding-left: 1rem;
      }
      .dph-field-error__list li + li { margin-top: 0.125rem; }
      @keyframes dph-field-error-in {
        from { opacity: 0; transform: translateY(-2px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dph-field-error { animation: none; }
      }
    `,
  ],
})
export class FieldErrorComponent {
  readonly errors = input<readonly string[]>([]);
  /** When set, errors only show after touched OR dirty becomes true. */
  readonly touched = input<boolean | undefined>(undefined);
  readonly dirty = input<boolean | undefined>(undefined);
  readonly showAll = input<boolean>(false);
  readonly icon = input<boolean>(true);
  readonly id = input<string>('');

  protected readonly visibleErrors = computed<readonly string[]>(() => {
    const all = this.errors();
    if (all.length === 0) return [];

    // If touched/dirty hints provided, gate visibility on them.
    const t = this.touched();
    const d = this.dirty();
    if ((t === false && d === false) || (t === false && d === undefined) || (t === undefined && d === false)) {
      return [];
    }

    return this.showAll() ? all : all.slice(0, 1);
  });
}
