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
  styleUrl: './wizard-buttons.component.scss',
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
