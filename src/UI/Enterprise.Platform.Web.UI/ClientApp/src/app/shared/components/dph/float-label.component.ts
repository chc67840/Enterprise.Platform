/**
 * ─── DPH UI KIT — FLOAT LABEL ───────────────────────────────────────────────────
 *
 * Standalone float-label wrapper for any input that doesn't have built-in
 * float-label support (e.g. wrapping a custom widget). Most usage should
 * prefer `dph-input` with `floatLabel: true`.
 *
 *   <dph-float-label [config]="{ label: 'Search', variant: 'in' }">
 *     <input pInputText [(ngModel)]="value" id="search" />
 *   </dph-float-label>
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FloatLabelModule } from 'primeng/floatlabel';

import type { FloatLabelConfig } from './dph.types';

@Component({
  selector: 'dph-float-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FloatLabelModule],
  template: `
    <p-floatlabel [variant]="config().variant || 'on'">
      <ng-content />
      <label [attr.for]="config().labelId || null">{{ config().label }}</label>
    </p-floatlabel>
  `,
  styleUrl: './float-label.component.scss',
})
export class FloatLabelComponent {
  readonly config = input.required<FloatLabelConfig>();
}
