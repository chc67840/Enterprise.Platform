/**
 * ─── DPH UI KIT — COLOR PICKER ──────────────────────────────────────────────────
 *
 * Wraps PrimeNG `<p-colorPicker>`. Value is the chosen color string in the
 * configured format (`'hex'` default → `'#1B3F73'`, `'rgb'` → `'rgb(...)'`,
 * `'hsb'` → `'hsb(...)'`).
 *
 *   <dph-color
 *     [(value)]="brand"
 *     [config]="{ label: 'Brand color', colorFormat: 'hex' }"
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
import { ColorPickerModule } from 'primeng/colorpicker';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export interface ColorFieldConfig {
  readonly label?: string;
  readonly hint?: string;
  readonly colorFormat?: 'hex' | 'rgb' | 'hsb';
  /** Inline panel (no popup trigger). Default `false`. */
  readonly inline?: boolean;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-color',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ColorPickerModule, FieldErrorComponent],
  template: `
    <div class="dph-color" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-color__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-color__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <p-colorPicker
        [inputId]="inputId()"
        [format]="config().colorFormat || 'hex'"
        [inline]="!!config().inline"
        [disabled]="!!config().disabled"
        [(ngModel)]="value"
        (onShow)="onFocus($event)"
        (onHide)="onBlur($event)"
        styleClass="dph-color__trigger"
        appendTo="body"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      />

      @if (config().hint && !invalidEffective()) {
        <p class="dph-color__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './color.component.scss',
})
export class ColorComponent {
  readonly config = input.required<ColorFieldConfig>();
  readonly value = model<string | null>(null);
  readonly blur = output<FocusEvent>();
  readonly focus = output<FocusEvent>();

  private readonly _autoId = signal<string>(`dph-color-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected onBlur(event: unknown): void {
    if (event instanceof FocusEvent) this.blur.emit(event);
  }
  protected onFocus(event: unknown): void {
    if (event instanceof FocusEvent) this.focus.emit(event);
  }
}
