/**
 * ─── DPH UI KIT — CURRENCY ──────────────────────────────────────────────────────
 *
 * Wraps PrimeNG `<p-inputNumber>` in `mode='currency'`. ISO-4217 code drives
 * the symbol + decimal places via `Intl.NumberFormat`; locale drives the
 * thousand-/decimal-separator. Value is the raw numeric (`123456.78`) — no
 * formatting characters in the bound model.
 *
 *   <dph-currency
 *     [(value)]="amount"
 *     [config]="{ label: 'Total', currency: 'USD', locale: 'en-US', min: 0 }"
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
import { InputNumberModule } from 'primeng/inputnumber';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export interface CurrencyFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  /** ISO 4217 — `'USD'`, `'EUR'`, `'INR'`, etc. */
  readonly currency: string;
  /** BCP-47 locale tag — `'en-US'`, `'de-DE'`. Default `'en-US'`. */
  readonly locale?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly clearable?: boolean;
  /** Show +/- step buttons next to the input. Default `false`. */
  readonly showButtons?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-currency',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputNumberModule, FieldErrorComponent],
  template: `
    <div class="dph-currency" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-currency__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-currency__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-inputNumber
        [inputId]="inputId()"
        [placeholder]="config().placeholder || ''"
        [disabled]="!!config().disabled"
        [readonly]="!!config().readonly"
        [min]="config().min ?? null"
        [max]="config().max ?? null"
        [step]="config().step ?? 1"
        [showButtons]="!!config().showButtons"
        [showClear]="!!config().clearable"
        mode="currency"
        [currency]="config().currency"
        [locale]="config().locale || 'en-US'"
        [invalid]="invalidEffective()"
        [(ngModel)]="value"
        (onBlur)="onBlur($any($event).originalEvent ?? $event)"
        (onFocus)="onFocus($any($event).originalEvent ?? $event)"
        styleClass="w-full"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      />

      @if (config().hint && !invalidEffective()) {
        <p class="dph-currency__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './currency.component.scss',
})
export class CurrencyComponent {
  readonly config = input.required<CurrencyFieldConfig>();
  readonly value = model<number | null>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-cur-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected onBlur(event: FocusEvent): void { this.blur.emit(event); }
  protected onFocus(event: FocusEvent): void { this.focus.emit(event); }
}
