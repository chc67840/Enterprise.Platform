/**
 * ─── DPH UI KIT — STEPS ─────────────────────────────────────────────────────────
 *
 * Multi-step wizard / progress indicator. Variants: horizontal (default,
 * compact dots on mobile) + vertical.
 *
 *   <dph-steps [config]="{ steps: wizardSteps, activeIndex: step() }" />
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { StepsConfig } from './dph.types';

@Component({
  selector: 'dph-steps',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol
      class="dph-steps"
      [attr.data-variant]="config().variant || 'horizontal'"
      role="list"
      aria-label="Wizard progress"
    >
      @for (s of config().steps; track $index) {
        <li
          class="dph-steps__item"
          [attr.data-state]="state($index)"
          [attr.aria-current]="$index === config().activeIndex ? 'step' : null"
        >
          <button
            type="button"
            class="dph-steps__btn"
            [disabled]="config().readonly || $index > config().activeIndex"
            (click)="onStepClick($index)"
            [attr.aria-label]="s.label + ' — step ' + ($index + 1) + ' of ' + config().steps.length"
          >
            <span class="dph-steps__marker">
              @if (state($index) === 'complete') {
                <i class="pi pi-check" aria-hidden="true"></i>
              } @else if (s.icon) {
                <i [class]="s.icon" aria-hidden="true"></i>
              } @else {
                {{ $index + 1 }}
              }
            </span>
            @if (config().showLabels !== false) {
              <span class="dph-steps__text">
                <span class="dph-steps__label">{{ s.label }}</span>
                @if (s.description) {
                  <span class="dph-steps__desc">{{ s.description }}</span>
                }
              </span>
            }
          </button>
          @if ((config().showConnectors !== false) && $index < config().steps.length - 1) {
            <span class="dph-steps__connector" aria-hidden="true"></span>
          }
        </li>
      }
    </ol>
  `,
  styles: [
    `
      :host { display: block; }
      .dph-steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        gap: 0;
      }
      .dph-steps[data-variant='vertical'] { flex-direction: column; }

      .dph-steps__item {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .dph-steps[data-variant='vertical'] .dph-steps__item { flex-direction: column; align-items: flex-start; }

      .dph-steps__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--ep-color-neutral-600);
        touch-action: manipulation;
        min-height: 2.75rem;
        flex: 1;
        min-width: 0;
      }
      .dph-steps__btn[disabled] { cursor: default; }
      .dph-steps__btn:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; border-radius: var(--ep-radius-sm); }

      .dph-steps__marker {
        display: inline-grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 9999px;
        background-color: var(--ep-color-neutral-200);
        color: var(--ep-color-neutral-700);
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .dph-steps__item[data-state='active'] .dph-steps__marker {
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
      }
      .dph-steps__item[data-state='active'] .dph-steps__btn { color: var(--ep-color-neutral-900); font-weight: 600; }

      .dph-steps__item[data-state='complete'] .dph-steps__marker {
        background-color: var(--ep-color-palmetto-600);
        color: #ffffff;
      }
      .dph-steps__item[data-state='complete'] .dph-steps__btn { color: var(--ep-color-neutral-700); }

      .dph-steps__text { display: inline-flex; flex-direction: column; min-width: 0; line-height: 1.2; }
      .dph-steps__label { font-size: 0.8125rem; }
      .dph-steps__desc { font-size: 0.6875rem; color: var(--ep-color-neutral-500); }

      .dph-steps__connector {
        flex: 1;
        height: 2px;
        background-color: var(--ep-color-neutral-200);
        align-self: center;
      }
      .dph-steps__item[data-state='complete'] + .dph-steps__item .dph-steps__connector,
      .dph-steps__item[data-state='complete'] .dph-steps__connector {
        background-color: var(--ep-color-palmetto-500);
      }
      .dph-steps[data-variant='vertical'] .dph-steps__connector {
        width: 2px;
        height: 1.5rem;
        margin-left: 0.875rem;
      }

      /* mobile collapse — hide labels except active */
      @media (max-width: 639px) {
        .dph-steps:not([data-variant='vertical']) .dph-steps__text { display: none; }
        .dph-steps:not([data-variant='vertical']) .dph-steps__item[data-state='active'] .dph-steps__text { display: inline-flex; }
      }
    `,
  ],
})
export class StepsComponent {
  readonly config = input.required<StepsConfig>();
  readonly stepClick = output<number>();

  protected state(idx: number): 'pending' | 'active' | 'complete' {
    const a = this.config().activeIndex;
    if (idx < a) return 'complete';
    if (idx === a) return 'active';
    return 'pending';
  }

  protected onStepClick(idx: number): void {
    if (this.config().readonly) return;
    if (idx > this.config().activeIndex) return;   // forward navigation blocked
    this.stepClick.emit(idx);
  }
}
