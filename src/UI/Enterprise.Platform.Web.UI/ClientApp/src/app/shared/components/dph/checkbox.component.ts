/**
 * ─── DPH UI KIT — CHECKBOX (single boolean) ─────────────────────────────────────
 *
 * Wraps PrimeNG's `<p-checkbox>` for a single boolean value. Label sits
 * INLINE to the right of the box (different from the label-above layout
 * used by other field types — this is the standard checkbox UX).
 *
 *   <dph-checkbox
 *     [(value)]="acceptsTerms"
 *     [config]="{ label: 'I agree to the terms', required: true }"
 *   />
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export interface CheckboxFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CheckboxModule, FieldErrorComponent],
  template: `
    <div class="dph-checkbox" [attr.data-size]="config().size || 'md'">
      <div class="dph-checkbox__row">
        <p-checkbox
          [inputId]="inputId()"
          [binary]="true"
          [disabled]="!!config().disabled || !!config().readonly"
          [invalid]="invalidEffective()"
          [(ngModel)]="value"
          (onChange)="onChange()"
          [attr.aria-required]="config().required ? 'true' : null"
          [attr.aria-invalid]="invalidEffective() ? 'true' : null"
          [attr.aria-describedby]="errorId()"
        />
        @if (config().label) {
          <label [for]="inputId()" class="dph-checkbox__label">
            {{ config().label }}
            @if (config().required) {
              <span class="dph-checkbox__required" aria-hidden="true">*</span>
            }
          </label>
        }
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-checkbox__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './checkbox.component.scss',
})
export class CheckboxComponent {
  readonly config = input.required<CheckboxFieldConfig>();
  readonly value = model<boolean>(false);
  readonly blur = output<FocusEvent>();
  readonly changed = output<boolean>();

  private readonly _autoId = signal<string>(`dph-checkbox-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected onChange(): void {
    this.changed.emit(this.value());
  }
}
