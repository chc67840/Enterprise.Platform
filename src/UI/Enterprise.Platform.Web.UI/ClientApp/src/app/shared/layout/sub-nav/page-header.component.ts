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
  styleUrl: './page-header.component.scss',
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
