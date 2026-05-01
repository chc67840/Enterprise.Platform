/**
 * ─── DPH UI KIT — RADIO GROUP ───────────────────────────────────────────────────
 *
 * Wraps PrimeNG's `<p-radioButton>` rendered once per option. Renders
 * vertically by default; pass `orientation: 'horizontal'` for an inline
 * row (only viable with short labels + few options).
 *
 * For large option sets prefer `<dph-select>`; radios are best at 2–6
 * options where every option needs to be visible at once.
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
import { RadioButtonModule } from 'primeng/radiobutton';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { OptionItem, Size } from './dph.types';

export interface RadioGroupFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly options: readonly OptionItem[];
  readonly orientation?: 'vertical' | 'horizontal';
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
  selector: 'dph-radio-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RadioButtonModule, FieldErrorComponent],
  template: `
    <fieldset class="dph-radio-group" [attr.data-size]="config().size || 'md'" [attr.data-orientation]="config().orientation || 'vertical'">
      @if (config().label) {
        <legend class="dph-radio-group__legend">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-radio-group__required" aria-hidden="true">*</span>
          }
        </legend>
      }

      <div class="dph-radio-group__options" role="radiogroup" [attr.aria-labelledby]="legendId()">
        @for (option of config().options; track option.value; let i = $index) {
          <div class="dph-radio-group__option">
            <p-radioButton
              [inputId]="optionId(i)"
              [name]="groupName()"
              [value]="option.value"
              [disabled]="!!option.disabled || !!config().disabled || !!config().readonly"
              [(ngModel)]="value"
              (onClick)="onChange()"
            />
            <label [for]="optionId(i)" class="dph-radio-group__label">
              @if (option.icon) { <i [class]="option.icon" aria-hidden="true"></i> }
              {{ option.label }}
            </label>
          </div>
        }
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-radio-group__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </fieldset>
  `,
  styleUrl: './radio-group.component.scss',
})
export class RadioGroupComponent {
  readonly config = input.required<RadioGroupFieldConfig>();
  readonly value = model<unknown>(null);
  readonly changed = output<unknown>();

  private readonly _autoId = signal<string>(`dph-radio-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly legendId = computed(() => `${this.inputId()}-legend`);
  protected readonly groupName = computed(() => this.config().name || this.inputId());

  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected optionId(idx: number): string {
    return `${this.inputId()}-${idx}`;
  }

  protected onChange(): void {
    this.changed.emit(this.value());
  }
}
