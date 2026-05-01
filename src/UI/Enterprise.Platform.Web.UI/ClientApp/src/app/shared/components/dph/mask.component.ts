/**
 * ─── DPH UI KIT — MASK ──────────────────────────────────────────────────────────
 *
 * Wraps PrimeNG `<p-inputMask>` for fixed-format text inputs (phone, SSN,
 * postal codes). Mask syntax (`9` = digit, `a` = letter, `*` = alphanumeric)
 * is forwarded as-is.
 *
 *   <dph-mask
 *     [(value)]="phone"
 *     [config]="{ label: 'Phone', mask: '(999) 999-9999', placeholder: '(___) ___-____' }"
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
import { InputMaskModule } from 'primeng/inputmask';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export interface MaskFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  /** PrimeNG mask syntax. Required — defines the input shape. */
  readonly mask: string;
  /** Character shown in unfilled slots. Default `'_'`. */
  readonly slotChar?: string;
  /** Forward the formatted value (with mask chars) instead of the raw entry. Default `true`. */
  readonly autoClear?: boolean;
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
  selector: 'dph-mask',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InputMaskModule, FieldErrorComponent],
  template: `
    <div class="dph-mask" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-mask__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-mask__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-inputMask
        [inputId]="inputId()"
        [mask]="config().mask"
        [placeholder]="config().placeholder || ''"
        [slotChar]="config().slotChar || '_'"
        [autoClear]="config().autoClear !== false"
        [disabled]="!!config().disabled"
        [readonly]="!!config().readonly"
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
        <p class="dph-mask__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './mask.component.scss',
})
export class MaskComponent {
  readonly config = input.required<MaskFieldConfig>();
  readonly value = model<string | null>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-mask-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected onBlur(event: FocusEvent): void { this.blur.emit(event); }
  protected onFocus(event: FocusEvent): void { this.focus.emit(event); }
}
