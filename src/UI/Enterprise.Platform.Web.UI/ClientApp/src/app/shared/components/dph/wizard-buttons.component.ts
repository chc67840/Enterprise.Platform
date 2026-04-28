/**
 * ─── DPH UI KIT — WIZARD BUTTONS ────────────────────────────────────────────────
 *
 * Standardized Back / Next / Cancel / Skip / Finish row that pairs with
 * <dph-steps>. Sticky at viewport bottom on mobile when `sticky=true`.
 *
 *   <dph-wizard-buttons
 *     [config]="{ isFirst: idx === 0, isLast: idx === steps.length - 1, nextLoading: saving() }"
 *     (back)="prev()" (next)="next()" (cancel)="abort()" (finish)="submit()"
 *   />
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { WizardButtonsConfig } from './dph.types';

@Component({
  selector: 'dph-wizard-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="dph-wb" [class.dph-wb--sticky]="config().sticky">
      <div class="dph-wb__left">
        @if (showCancel()) {
          <button type="button" class="dph-wb__btn dph-wb__btn--ghost" (click)="cancel.emit()">
            {{ config().cancelLabel || 'Cancel' }}
          </button>
        }
      </div>
      <div class="dph-wb__right">
        @if (showSkip() && config().canSkip) {
          <button type="button" class="dph-wb__btn dph-wb__btn--ghost" (click)="skip.emit()">
            {{ config().skipLabel || 'Skip' }}
          </button>
        }
        @if (showBack() && !config().isFirst) {
          <button type="button" class="dph-wb__btn dph-wb__btn--secondary" (click)="back.emit()">
            <i class="pi pi-arrow-left" aria-hidden="true"></i>
            {{ config().backLabel || 'Back' }}
          </button>
        }
        @if (config().isLast && showFinish()) {
          <button
            type="button"
            class="dph-wb__btn dph-wb__btn--primary"
            [disabled]="config().nextDisabled || config().nextLoading"
            (click)="finish.emit()"
          >
            @if (config().nextLoading) {
              <span class="dph-wb__spin" aria-hidden="true"></span>
            } @else {
              <i class="pi pi-check" aria-hidden="true"></i>
            }
            {{ config().finishLabel || 'Finish' }}
          </button>
        } @else if (showNext()) {
          <button
            type="button"
            class="dph-wb__btn dph-wb__btn--primary"
            [disabled]="config().nextDisabled || config().nextLoading"
            (click)="next.emit()"
          >
            {{ config().nextLabel || 'Next' }}
            @if (config().nextLoading) {
              <span class="dph-wb__spin" aria-hidden="true"></span>
            } @else {
              <i class="pi pi-arrow-right" aria-hidden="true"></i>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .dph-wb {
        display: flex; align-items: center; justify-content: space-between;
        gap: 0.75rem; padding: 0.75rem 0; margin-top: 1rem;
        border-top: 1px solid var(--ep-color-neutral-200);
      }
      .dph-wb--sticky {
        position: sticky; bottom: 0; background: #fff; z-index: 1;
        padding: 0.75rem 1rem; margin: 1rem -1rem -1rem;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
      }
      .dph-wb__left, .dph-wb__right { display: inline-flex; gap: 0.5rem; align-items: center; }

      .dph-wb__btn {
        display: inline-flex; align-items: center; gap: 0.375rem;
        padding: 0.5rem 1rem; border-radius: var(--ep-radius-md);
        font-size: 0.875rem; font-weight: 500; cursor: pointer;
        border: 1px solid transparent; min-height: 2.5rem;
        transition: background-color 100ms, border-color 100ms;
      }
      .dph-wb__btn:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-wb__btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .dph-wb__btn--primary { background: var(--ep-color-primary-700); color: #fff; }
      .dph-wb__btn--primary:hover:not(:disabled) { background: var(--ep-color-primary-800); }

      .dph-wb__btn--secondary {
        background: #fff; color: var(--ep-color-neutral-800); border-color: var(--ep-color-neutral-300);
      }
      .dph-wb__btn--secondary:hover:not(:disabled) { background: var(--ep-color-neutral-50); border-color: var(--ep-color-neutral-400); }

      .dph-wb__btn--ghost { background: transparent; color: var(--ep-color-neutral-600); }
      .dph-wb__btn--ghost:hover:not(:disabled) { background: var(--ep-color-neutral-100); color: var(--ep-color-neutral-900); }

      .dph-wb__spin {
        width: 0.875rem; height: 0.875rem;
        border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
        border-radius: 9999px; animation: dph-wb-spin 0.7s linear infinite;
      }
      @keyframes dph-wb-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .dph-wb__spin { animation: none; } }
    `,
  ],
})
export class WizardButtonsComponent {
  readonly config = input.required<WizardButtonsConfig>();

  readonly back = output<void>();
  readonly next = output<void>();
  readonly cancel = output<void>();
  readonly skip = output<void>();
  readonly finish = output<void>();

  protected readonly showBack = computed<boolean>(() => this.config().showBack !== false);
  protected readonly showNext = computed<boolean>(() => this.config().showNext !== false);
  protected readonly showCancel = computed<boolean>(() => this.config().showCancel !== false);
  protected readonly showSkip = computed<boolean>(() => this.config().showSkip !== false);
  protected readonly showFinish = computed<boolean>(() => this.config().showFinish !== false);
}
