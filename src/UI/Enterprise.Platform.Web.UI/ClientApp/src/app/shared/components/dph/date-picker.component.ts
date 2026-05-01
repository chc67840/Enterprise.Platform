/**
 * ─── DPH UI KIT — DATE PICKER ───────────────────────────────────────────────────
 *
 * Wraps PrimeNG's `<p-datePicker>` for `'date' | 'datetime' | 'time'`
 * field types. Single component handles all three by toggling
 * `[showTime]` + `[timeOnly]`.
 *
 *   <dph-date-picker
 *     [(value)]="dob"
 *     [config]="{ kind: 'date', label: 'Date of birth', required: true, maxDate: today }"
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
import { DatePickerModule } from 'primeng/datepicker';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export type DatePickerKind = 'date' | 'datetime' | 'time';

export interface DatePickerFieldConfig {
  readonly kind: DatePickerKind;
  readonly label?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  readonly inlineCalendar?: boolean;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
  readonly disabledDates?: readonly (Date | string)[];
  readonly showSeconds?: boolean;
  /** '12' = AM/PM, '24' = military. Default 24. */
  readonly hourFormat?: '12' | '24';
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePickerModule, FieldErrorComponent],
  template: `
    <div class="dph-date-picker" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-date-picker__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-date-picker__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-datePicker
        [inputId]="inputId()"
        [placeholder]="config().placeholder || ''"
        [disabled]="!!config().disabled"
        [readonlyInput]="!!config().readonly"
        [showClear]="!!config().clearable"
        [inline]="!!config().inlineCalendar"
        [showTime]="config().kind !== 'date'"
        [timeOnly]="config().kind === 'time'"
        [showSeconds]="!!config().showSeconds"
        [hourFormat]="config().hourFormat || '24'"
        [minDate]="normalisedMin()"
        [maxDate]="normalisedMax()"
        [disabledDates]="normalisedDisabled()"
        [invalid]="invalidEffective()"
        [(ngModel)]="value"
        (onBlur)="onBlur($event)"
        (onFocus)="onFocus($event)"
        styleClass="w-full"
        appendTo="body"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      />

      @if (config().hint && !invalidEffective()) {
        <p class="dph-date-picker__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './date-picker.component.scss',
})
export class DatePickerComponent {
  readonly config = input.required<DatePickerFieldConfig>();
  readonly value = model<Date | null>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-date-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected readonly normalisedMin = computed<Date | undefined>(() => toDate(this.config().minDate));
  protected readonly normalisedMax = computed<Date | undefined>(() => toDate(this.config().maxDate));
  protected readonly normalisedDisabled = computed<Date[]>(() => {
    const list = this.config().disabledDates;
    if (!list?.length) return [];
    return list.map(toDate).filter((d): d is Date => !!d);
  });

  protected onBlur(event: Event): void {
    if (event instanceof FocusEvent) this.blur.emit(event);
  }
  protected onFocus(event: Event): void {
    if (event instanceof FocusEvent) this.focus.emit(event);
  }
}

function toDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
