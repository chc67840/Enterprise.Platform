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
  styles: [
    `
      :host { display: block; }

      .dph-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .dph-form__header:empty,
      .dph-form__footer:empty { display: none; }

      .dph-form__body {
        display: grid;
        gap: 1rem;
      }
      .dph-form[data-gap='xs'] .dph-form__body { gap: 0.5rem; }
      .dph-form[data-gap='sm'] .dph-form__body { gap: 0.75rem; }
      .dph-form[data-gap='lg'] .dph-form__body { gap: 1.25rem; }
      .dph-form[data-gap='xl'] .dph-form__body { gap: 1.5rem; }
      .dph-form--dense .dph-form__body { gap: 0.5rem; }

      /* default 1-col */
      .dph-form[data-columns='1'] .dph-form__body { grid-template-columns: 1fr; }

      /* 2-col → 1 below sm */
      .dph-form[data-columns='2'] .dph-form__body {
        grid-template-columns: 1fr;
      }
      @media (min-width: 640px) {
        .dph-form[data-columns='2'] .dph-form__body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      /* 3-col → 2 below md → 1 below sm */
      .dph-form[data-columns='3'] .dph-form__body { grid-template-columns: 1fr; }
      @media (min-width: 640px) {
        .dph-form[data-columns='3'] .dph-form__body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (min-width: 1024px) {
        .dph-form[data-columns='3'] .dph-form__body { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }

      /* 4-col → 2 below lg → 1 below md */
      .dph-form[data-columns='4'] .dph-form__body { grid-template-columns: 1fr; }
      @media (min-width: 768px) {
        .dph-form[data-columns='4'] .dph-form__body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (min-width: 1280px) {
        .dph-form[data-columns='4'] .dph-form__body { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }

      /* inline variant */
      .dph-form[data-variant='inline'] .dph-form__body {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
      }

      .dph-form__footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-end;
        padding-top: 0.5rem;
        border-top: 1px solid var(--ep-color-neutral-200);
      }
      .dph-form__footer:empty { border-top: none; padding-top: 0; }
    `,
  ],
})
export class FormLayoutComponent {
  readonly config = input.required<FormLayoutConfig>();
}
