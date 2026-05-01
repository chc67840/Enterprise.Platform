/**
 * ─── DPH UI KIT — RANGE SLIDER ──────────────────────────────────────────────────
 *
 * Wraps PrimeNG `<p-slider>` for numeric range input. Value is either a single
 * `number` (single-thumb) or `[low, high]` tuple (`rangeMode: true`). Both
 * thumbs and the surrounding track honour the configured min / max / step.
 *
 *   <dph-range
 *     [(value)]="priceWindow"
 *     [config]="{ label: 'Price', min: 0, max: 1000, step: 10, rangeMode: true }"
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
import { SliderModule } from 'primeng/slider';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

/** Value bound to the model — single number or `[low, high]` tuple. */
export type RangeValue = number | readonly [number, number] | null;

export interface RangeFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly rangeMode?: boolean;
  readonly orientation?: 'horizontal' | 'vertical';
  /** Show a numeric readout next to the slider. Default `true`. */
  readonly showValue?: boolean;
  /** Suffix string appended to the readout (e.g. `'%'`, `' USD'`). */
  readonly valueSuffix?: string;
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
  selector: 'dph-range',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SliderModule, FieldErrorComponent],
  template: `
    <div class="dph-range" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-range__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-range__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="dph-range__row">
        <p-slider
          [min]="config().min ?? 0"
          [max]="config().max ?? 100"
          [step]="config().step ?? 1"
          [orientation]="config().orientation || 'horizontal'"
          [range]="!!config().rangeMode"
          [disabled]="!!config().disabled"
          [(ngModel)]="bindingValue"
          (onSlideEnd)="emitBlur()"
          styleClass="w-full dph-range__slider"
          [attr.aria-required]="config().required ? 'true' : null"
          [attr.aria-invalid]="invalidEffective() ? 'true' : null"
          [attr.aria-describedby]="errorId()"
        />

        @if (showValue()) {
          <span class="dph-range__readout" aria-live="polite">{{ readout() }}</span>
        }
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-range__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './range.component.scss',
})
export class RangeComponent {
  readonly config = input.required<RangeFieldConfig>();
  readonly value = model<RangeValue>(null);
  readonly blur = output<void>();
  readonly focus = output<void>();

  private readonly _autoId = signal<string>(`dph-range-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );
  protected readonly showValue = computed(() => this.config().showValue !== false);

  /**
   * PrimeNG's `p-slider` writes either a `number` (single thumb) or a
   * mutable `number[]` (range mode). We expose a typed adapter so the host's
   * `model<RangeValue>()` stays clean — single mode swaps in/out the scalar,
   * range mode round-trips a `[number, number]` tuple.
   */
  protected get bindingValue(): number | number[] {
    const v = this.value();
    if (this.config().rangeMode) {
      if (Array.isArray(v)) return [v[0], v[1]];
      const min = this.config().min ?? 0;
      const max = this.config().max ?? 100;
      return [min, max];
    }
    return typeof v === 'number' ? v : (this.config().min ?? 0);
  }
  protected set bindingValue(v: number | number[]) {
    if (Array.isArray(v) && v.length === 2) {
      this.value.set([v[0]!, v[1]!] as const);
    } else if (typeof v === 'number') {
      this.value.set(v);
    }
  }

  protected readonly readout = computed<string>(() => {
    const v = this.value();
    const suffix = this.config().valueSuffix || '';
    if (Array.isArray(v)) return `${v[0]}${suffix} – ${v[1]}${suffix}`;
    if (typeof v === 'number') return `${v}${suffix}`;
    return '';
  });

  protected emitBlur(): void { this.blur.emit(); }
}
