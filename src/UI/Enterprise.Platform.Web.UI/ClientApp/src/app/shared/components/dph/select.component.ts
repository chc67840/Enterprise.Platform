/**
 * ─── DPH UI KIT — SELECT (single-pick dropdown) ─────────────────────────────────
 *
 * Wraps PrimeNG's `<p-select>` (renamed from `<p-dropdown>` in v18+) with
 * the same shape DPH form fields use elsewhere: typed config, `model()`
 * value binding, OnPush change detection, brand-token-driven styling.
 *
 * Phase A — schema-form dispatches `field.type === 'select'` here.
 *
 *   <dph-select
 *     [(value)]="role"
 *     [config]="{ label: 'Role', required: true, options: [...] }"
 *     (blur)="onBlur()"
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
import { SelectModule } from 'primeng/select';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { OptionItem, Size } from './dph.types';

export interface SelectFieldConfig {
  readonly label?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly options: readonly OptionItem[];
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  readonly filterable?: boolean;
  readonly emptyOptionsText?: string;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, FieldErrorComponent],
  template: `
    <div class="dph-select" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-select__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-select__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-select
        [inputId]="inputId()"
        [options]="mutableOptions()"
        optionLabel="label"
        optionValue="value"
        optionDisabled="disabled"
        [placeholder]="config().placeholder || ''"
        [disabled]="!!config().disabled"
        [readonly]="!!config().readonly"
        [showClear]="!!config().clearable"
        [filter]="!!config().filterable"
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
        <p class="dph-select__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './select.component.scss',
})
export class SelectComponent {
  readonly config = input.required<SelectFieldConfig>();
  readonly value = model<unknown>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-select-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );
  /** PrimeNG p-select declares `options: any[]` (mutable) so we spread once. */
  protected readonly mutableOptions = computed<OptionItem[]>(() => [...this.config().options]);

  protected onBlur(event: FocusEvent): void { this.blur.emit(event); }
  protected onFocus(event: FocusEvent): void { this.focus.emit(event); }
}
