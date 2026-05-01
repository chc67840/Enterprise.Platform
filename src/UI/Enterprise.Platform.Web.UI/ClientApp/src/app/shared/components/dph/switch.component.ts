/**
 * ─── DPH UI KIT — TOGGLE SWITCH ─────────────────────────────────────────────────
 *
 * Wraps PrimeNG's `<p-toggleSwitch>` (renamed from `<p-inputSwitch>` in
 * v17+). Use for ON/OFF settings where the label communicates state at
 * a glance ("Notifications enabled"); use `<dph-checkbox>` for opt-in
 * style booleans ("I agree to the terms").
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
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import type { Size } from './dph.types';

export interface SwitchFieldConfig {
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
  selector: 'dph-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToggleSwitchModule, FieldErrorComponent],
  template: `
    <div class="dph-switch" [attr.data-size]="config().size || 'md'">
      <div class="dph-switch__row">
        <p-toggleSwitch
          [inputId]="inputId()"
          [disabled]="!!config().disabled || !!config().readonly"
          [(ngModel)]="value"
          (onChange)="onChange()"
          [attr.aria-required]="config().required ? 'true' : null"
          [attr.aria-invalid]="invalidEffective() ? 'true' : null"
          [attr.aria-describedby]="errorId()"
        />
        @if (config().label) {
          <label [for]="inputId()" class="dph-switch__label">
            {{ config().label }}
            @if (config().required) {
              <span class="dph-switch__required" aria-hidden="true">*</span>
            }
          </label>
        }
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-switch__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './switch.component.scss',
})
export class SwitchComponent {
  readonly config = input.required<SwitchFieldConfig>();
  readonly value = model<boolean>(false);
  readonly blur = output<FocusEvent>();
  readonly changed = output<boolean>();

  private readonly _autoId = signal<string>(`dph-switch-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected onChange(): void {
    this.changed.emit(this.value());
  }
}
