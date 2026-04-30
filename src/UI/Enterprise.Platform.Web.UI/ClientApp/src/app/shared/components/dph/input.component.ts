/**
 * ─── DPH UI KIT — INPUT ─────────────────────────────────────────────────────────
 *
 * Universal text/number/email/password/url/tel/search/textarea wrapper.
 * Supports prefix/suffix icons + addon text, character counter, clear
 * button, password toggle, loading suffix, error state with linked
 * <dph-field-error>.
 *
 * Float-label is built in via `floatLabel: true` in the config.
 *
 *   <dph-input
 *     [(value)]="email"
 *     [config]="{
 *       type: 'email',
 *       label: 'Email',
 *       placeholder: 'you@example.com',
 *       required: true,
 *       prefixIcon: 'pi pi-envelope',
 *       errors: form.errors.email,
 *     }"
 *     (blur)="onBlur()"
 *   />
 */
import { CommonModule } from '@angular/common';
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
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { PasswordModule } from 'primeng/password';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { InputConfig } from './dph.types';

@Component({
  selector: 'dph-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    PasswordModule,
    FieldErrorComponent,
  ],
  template: `
    <div class="dph-input" [attr.data-size]="config().size || 'md'" [class.dph-input--float]="!!config().floatLabel">
      @if (config().label && !config().floatLabel) {
        <label [for]="inputId()" class="dph-input__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-input__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div
        class="dph-input__field"
        [attr.data-variant]="config().variant || 'outlined'"
        [class.dph-input__field--invalid]="invalidEffective()"
        [class.dph-input__field--disabled]="!!config().disabled"
      >
        @if (config().prefixIcon || config().prefixText) {
          <span class="dph-input__addon dph-input__addon--prefix">
            @if (config().prefixIcon) { <i [class]="config().prefixIcon" aria-hidden="true"></i> }
            @if (config().prefixText) { <span>{{ config().prefixText }}</span> }
          </span>
        }

        @switch (config().type) {
          @case ('textarea') {
            <textarea
              pTextarea
              [id]="inputId()"
              [name]="config().name || ''"
              [rows]="config().rows || 3"
              [autoResize]="config().autoResize ?? false"
              [placeholder]="config().placeholder || ''"
              [readonly]="!!config().readonly"
              [disabled]="!!config().disabled"
              [maxlength]="config().maxLength ?? null"
              [attr.aria-required]="config().required ? 'true' : null"
              [attr.aria-invalid]="invalidEffective() ? 'true' : null"
              [attr.aria-describedby]="errorId()"
              [(ngModel)]="value"
              (blur)="onBlur($event)"
              (focus)="onFocus($event)"
            ></textarea>
          }
          @case ('number') {
            <p-inputNumber
              [inputId]="inputId()"
              [name]="config().name || ''"
              [placeholder]="config().placeholder || ''"
              [readonly]="!!config().readonly"
              [disabled]="!!config().disabled"
              [min]="config().min ?? null"
              [max]="config().max ?? null"
              [step]="config().step ?? 1"
              [locale]="config().locale ?? 'en-US'"
              [mode]="config().currency ? 'currency' : 'decimal'"
              [currency]="config().currency || 'USD'"
              [showClear]="!!config().clearable"
              [(ngModel)]="numberValue"
              (onBlur)="onBlur($any($event).originalEvent ?? $event)"
              (onFocus)="onFocus($any($event).originalEvent ?? $event)"
            />
          }
          @case ('password') {
            <p-password
              [inputId]="inputId()"
              [placeholder]="config().placeholder || ''"
              [feedback]="false"
              [toggleMask]="true"
              [disabled]="!!config().disabled"
              [(ngModel)]="value"
              (onBlur)="onBlur($any($event).originalEvent ?? $event)"
              (onFocus)="onFocus($any($event).originalEvent ?? $event)"
              styleClass="w-full"
            />
          }
          @default {
            <input
              pInputText
              [id]="inputId()"
              [name]="config().name || ''"
              [type]="config().type"
              [placeholder]="config().placeholder || ''"
              [readonly]="!!config().readonly"
              [disabled]="!!config().disabled"
              [maxlength]="config().maxLength ?? null"
              [autocomplete]="config().autocomplete || ''"
              [attr.aria-required]="config().required ? 'true' : null"
              [attr.aria-invalid]="invalidEffective() ? 'true' : null"
              [attr.aria-describedby]="errorId()"
              [(ngModel)]="value"
              (blur)="onBlur($event)"
              (focus)="onFocus($event)"
            />
          }
        }

        @if (config().clearable && hasValue() && !config().disabled && !config().readonly && config().type !== 'number' && config().type !== 'password') {
          <button
            type="button"
            class="dph-input__clear"
            [attr.aria-label]="'Clear ' + (config().label || 'value')"
            (click)="onClear()"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        }

        @if (config().loading) {
          <span class="dph-input__addon dph-input__addon--suffix">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          </span>
        } @else if (config().suffixIcon || config().suffixText) {
          <span class="dph-input__addon dph-input__addon--suffix">
            @if (config().suffixIcon) { <i [class]="config().suffixIcon" aria-hidden="true"></i> }
            @if (config().suffixText) { <span>{{ config().suffixText }}</span> }
          </span>
        }
      </div>

      @if (config().showCounter && config().maxLength) {
        <div class="dph-input__counter">{{ counterText() }}</div>
      }

      @if (config().hint && !invalidEffective()) {
        <p class="dph-input__hint">{{ config().hint }}</p>
      }

      <dph-field-error
        [errors]="config().errors || []"
        [id]="errorId()"
      />
    </div>
  `,
  styleUrl: './input.component.scss',
})
export class InputComponent {
  readonly config = input.required<InputConfig>();
  // `model()` auto-publishes a `valueChange` output — do NOT also declare an
  // explicit `valueChange = output<>()`, that creates a name collision and
  // silently drops child writes from reaching the parent's `(valueChange)`
  // listener (which is how the schema-form binds field values to its
  // FormGroup). The auto-output fires on `value.set()` from any source
  // (ngModel two-way included), which is exactly what we want.
  readonly value = model<string | number | null>('');

  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();
  readonly cleared = output<void>();

  /** Auto-generated id when not provided in config — used for label[for] + aria-describedby. */
  private readonly _autoId = signal<string>(`dph-input-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);

  protected readonly hasValue = computed(() => {
    const v = this.value();
    return v !== null && v !== undefined && v !== '';
  });

  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  /** PrimeNG p-inputNumber binds to `number | null`, not `string | number | null`. */
  protected readonly numberValue = computed<number | null>(() => {
    const v = this.value();
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return null;
  });

  protected readonly counterText = computed(() => {
    const max = this.config().maxLength ?? 0;
    const v = this.value();
    const len = typeof v === 'string' ? v.length : 0;
    return `${len}/${max}`;
  });

  protected onBlur(event: FocusEvent): void {
    this.blur.emit(event);
  }

  protected onFocus(event: FocusEvent): void {
    this.focus.emit(event);
  }

  protected onClear(): void {
    this.value.set('');
    this.cleared.emit();
  }
}
