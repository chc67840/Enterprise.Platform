/**
 * ─── DPH UI KIT — MULTI-SELECT ──────────────────────────────────────────────────
 *
 * Wraps PrimeNG's `<p-multiSelect>`. Same shape as `dph-select` but the
 * value is a readonly array. `chipDisplay: true` shows selected items as
 * chips inside the trigger; `false` falls back to the count summary
 * ("3 items selected").
 *
 * Phase A — schema-form dispatches `field.type === 'multiselect'` here.
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
import { MultiSelectModule } from 'primeng/multiselect';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { OptionItem, Size } from './dph.types';

export interface MultiSelectFieldConfig {
  readonly label?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly options: readonly OptionItem[];
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly filterable?: boolean;
  readonly chipDisplay?: boolean;
  readonly emptyOptionsText?: string;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MultiSelectModule, FieldErrorComponent],
  template: `
    <div class="dph-multi-select" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-multi-select__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-multi-select__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-multiSelect
        [inputId]="inputId()"
        [options]="mutableOptions()"
        optionLabel="label"
        optionValue="value"
        optionDisabled="disabled"
        [placeholder]="config().placeholder || ''"
        [disabled]="!!config().disabled"
        [readonly]="!!config().readonly"
        [filter]="config().filterable !== false"
        [display]="(config().chipDisplay !== false) ? 'chip' : 'comma'"
        [emptyMessage]="config().emptyOptionsText || 'No options'"
        [invalid]="invalidEffective()"
        [(ngModel)]="value"
        (onBlur)="onBlur($any($event).originalEvent ?? $event)"
        (onFocus)="onFocus($any($event).originalEvent ?? $event)"
        styleClass="w-full"
        appendTo="body"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      />

      @if (config().hint && !invalidEffective()) {
        <p class="dph-multi-select__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './multi-select.component.scss',
})
export class MultiSelectComponent {
  readonly config = input.required<MultiSelectFieldConfig>();
  readonly value = model<readonly unknown[] | null>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-multi-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );
  /** PrimeNG p-multiSelect declares `options: any[]` (mutable) so we spread once. */
  protected readonly mutableOptions = computed<OptionItem[]>(() => [...this.config().options]);

  protected onBlur(event: FocusEvent): void { this.blur.emit(event); }
  protected onFocus(event: FocusEvent): void { this.focus.emit(event); }
}
