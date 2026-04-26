/**
 * ─── shared/layout/sub-nav/page-header ──────────────────────────────────────────
 *
 * Generic page header — title, subtitle, icon, badge, primary CTA, secondary
 * actions, optional back link, optional help tooltip. Domain-agnostic; every
 * visible behaviour driven by the `config` signal input.
 *
 * USAGE
 *   1. Static — declare in route data:
 *        data: { pageHeader: { title: 'Users', primaryAction: { ... } } }
 *      The orchestrator picks it up automatically.
 *   2. Dynamic — inject PageHeaderService and call set(config) when the
 *      config depends on async-resolved data (e.g. title = patient name
 *      from API). The service signal wins over route data.
 *
 * CONTRACT
 *   - <h1> is rendered exactly once. Pages must NOT render their own h1
 *     (WCAG 2.4.6 — single h1 per page).
 *   - Action clicks emit `actionKey` strings via `(action)`. Host page
 *     handles the side-effect. Component owns zero business logic.
 *   - Loading state on the primary action shows a spinner and disables the
 *     button (prevents double-submit).
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

import type { PageHeaderAction, PageHeaderConfig } from './sub-nav.types';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, TooltipModule],
  template: `
    @if (config(); as cfg) {
      <header class="ep-page-header">
        @if (cfg.backRoute) {
          <a
            [routerLink]="cfg.backRoute"
            class="ep-page-header__back"
          >
            <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
            <span>Back</span>
          </a>
        }

        <div class="ep-page-header__row">
          <div class="ep-page-header__title-block">
            @if (cfg.icon) {
              <span class="ep-page-header__icon" aria-hidden="true">
                <i [class]="cfg.icon"></i>
              </span>
            }
            <div class="ep-page-header__text">
              <h1 class="ep-page-header__title">
                {{ cfg.title }}
                @if (cfg.badge) {
                  <span
                    class="ep-page-header__badge"
                    [attr.data-variant]="cfg.badge.variant"
                  >{{ cfg.badge.label }}</span>
                }
                @if (cfg.helpTooltip) {
                  <button
                    type="button"
                    class="ep-page-header__help"
                    [pTooltip]="cfg.helpTooltip"
                    tooltipPosition="bottom"
                    [attr.aria-label]="cfg.helpTooltip"
                  >
                    <i class="pi pi-question-circle text-sm" aria-hidden="true"></i>
                  </button>
                }
              </h1>
              @if (cfg.subtitle) {
                <p class="ep-page-header__subtitle">{{ cfg.subtitle }}</p>
              }
            </div>
          </div>

          @if (hasActions()) {
            <div class="ep-page-header__actions">
              @for (a of (cfg.secondaryActions ?? []); track a.actionKey) {
                <button
                  [type]="a.type ?? 'button'"
                  class="ep-page-header__btn ep-page-header__btn--secondary"
                  [disabled]="a.disabled"
                  [attr.aria-label]="a.label"
                  (click)="onActionClick(a)"
                >
                  @if (a.icon) { <i [class]="a.icon" aria-hidden="true"></i> }
                  <span>{{ a.label }}</span>
                </button>
              }
              @if (cfg.primaryAction; as p) {
                <button
                  [type]="p.type ?? 'button'"
                  class="ep-page-header__btn ep-page-header__btn--primary"
                  [disabled]="p.disabled || p.loading"
                  [attr.aria-busy]="p.loading"
                  [attr.aria-label]="p.label"
                  (click)="onActionClick(p)"
                >
                  @if (p.loading) {
                    <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
                  } @else if (p.icon) {
                    <i [class]="p.icon" aria-hidden="true"></i>
                  }
                  <span>{{ p.label }}</span>
                </button>
              }
            </div>
          }
        </div>
      </header>
    }
  `,
  styles: [
    `
      :host { display: block; }

      .ep-page-header {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem 0 1.25rem;
      }

      /* back link — sits above the title row */
      .ep-page-header__back {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        align-self: flex-start;
        padding: 0.25rem 0.5rem 0.25rem 0;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--ep-color-neutral-600);
        text-decoration: none;
        border-radius: 0.375rem;
      }
      .ep-page-header__back:hover { color: var(--ep-color-primary-700); }
      .ep-page-header__back:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      /* main row — title block + actions */
      .ep-page-header__row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 1rem;
      }

      .ep-page-header__title-block {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        flex: 1 1 auto;
        min-width: 0;
      }

      .ep-page-header__icon {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.5rem;
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-700);
        font-size: 1.125rem;
        flex-shrink: 0;
      }

      .ep-page-header__text { min-width: 0; }

      /* WCAG 2.4.6 — single h1 per page */
      .ep-page-header__title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: -0.015em;
        color: var(--ep-color-neutral-900);
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .ep-page-header__subtitle {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: var(--ep-color-neutral-600);
      }

      /* badge variants — driven by [data-variant] (Tailwind v4 JIT-safe) */
      .ep-page-header__badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        line-height: 1;
      }
      .ep-page-header__badge[data-variant='success'] {
        background-color: var(--ep-color-palmetto-100);
        color: var(--ep-color-palmetto-800);
      }
      .ep-page-header__badge[data-variant='warning'] {
        background-color: var(--ep-color-jessamine-100);
        color: var(--ep-color-jessamine-800);
      }
      .ep-page-header__badge[data-variant='danger'] {
        background-color: var(--ep-color-danger-100);
        color: var(--ep-color-danger-700);
      }
      .ep-page-header__badge[data-variant='info'] {
        background-color: var(--ep-color-primary-100);
        color: var(--ep-color-primary-800);
      }
      .ep-page-header__badge[data-variant='neutral'] {
        background-color: var(--ep-color-neutral-200);
        color: var(--ep-color-neutral-800);
      }

      /* help tooltip button */
      .ep-page-header__help {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 9999px;
        background: transparent;
        color: var(--ep-color-neutral-500);
        border: none;
        cursor: pointer;
      }
      .ep-page-header__help:hover { color: var(--ep-color-primary-700); }
      .ep-page-header__help:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      /* actions cluster — right-aligned on wide, stacked below title on narrow */
      .ep-page-header__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-left: auto;
      }
      @media (max-width: 639px) {
        .ep-page-header__actions {
          margin-left: 0;
          width: 100%;
        }
        .ep-page-header__btn { flex: 1 1 auto; justify-content: center; }
      }

      .ep-page-header__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        border-radius: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
        min-height: 2.25rem;
      }
      .ep-page-header__btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-page-header__btn[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .ep-page-header__btn--primary {
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
      }
      .ep-page-header__btn--primary:hover:not([disabled]) {
        background-color: var(--ep-color-primary-800);
      }

      .ep-page-header__btn--secondary {
        background-color: transparent;
        color: var(--ep-color-neutral-800);
        border-color: var(--ep-color-neutral-300);
      }
      .ep-page-header__btn--secondary:hover:not([disabled]) {
        background-color: var(--ep-color-neutral-100);
        border-color: var(--ep-color-neutral-400);
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly config = input.required<PageHeaderConfig>();

  /**
   * Single output stream. Host pages switch on actionKey to dispatch.
   * Component owns zero business logic.
   */
  readonly action = output<string>();

  protected readonly hasActions = computed(() => {
    const cfg = this.config();
    return !!cfg.primaryAction || (cfg.secondaryActions?.length ?? 0) > 0;
  });

  protected onActionClick(a: PageHeaderAction): void {
    if (a.disabled || a.loading) return;
    this.action.emit(a.actionKey);
  }
}
