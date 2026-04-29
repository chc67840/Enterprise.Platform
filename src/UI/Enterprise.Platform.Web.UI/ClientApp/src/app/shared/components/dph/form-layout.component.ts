/**
 * ─── DPH UI KIT — FORM LAYOUT ───────────────────────────────────────────────────
 *
 * Generic responsive layout wrapper for forms. Variants: grid (N-column
 * grid that collapses on narrow viewports), stacked (single column),
 * inline (horizontal field list), tabbed/wizard placeholders.
 *
 *   <dph-form-layout [config]="{ variant: 'grid', columns: 2, gap: 'md' }">
 *     <ng-container slot="header">...</ng-container>
 *     <dph-input ... />
 *     <dph-input ... />
 *     <ng-container slot="footer">...</ng-container>
 *   </dph-form-layout>
 *
 * Responsive collapse: 4-col → 2-col below lg → 1-col below md;
 * 3-col → 2-col below md → 1-col below sm; 2-col → 1-col below sm.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { FormLayoutConfig } from './dph.types';

@Component({
  selector: 'dph-form-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dph-form"
      [attr.data-variant]="config().variant"
      [attr.data-columns]="config().columns ?? 1"
      [attr.data-gap]="config().gap ?? 'md'"
      [attr.data-label-pos]="config().labelPosition ?? 'top'"
      [class.dph-form--dense]="!!config().dense"
    >
      <header class="dph-form__header">
        <ng-content select="[slot=header]" />
      </header>

      <div class="dph-form__body">
        <ng-content />
      </div>

      <footer class="dph-form__footer">
        <ng-content select="[slot=footer]" />
        <ng-content select="[slot=actions]" />
      </footer>
    </div>
  `,
  styleUrl: './form-layout.component.scss',
})
export class FormLayoutComponent {
  readonly config = input.required<FormLayoutConfig>();
}
