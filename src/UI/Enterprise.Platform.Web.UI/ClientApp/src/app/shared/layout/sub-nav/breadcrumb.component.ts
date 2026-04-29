/**
 * ─── shared/layout/sub-nav/breadcrumb ───────────────────────────────────────────
 *
 * Pure presentation. Items come from `BreadcrumbService` (auto-generated
 * from router data). The component never owns logic — it only renders.
 *
 * a11y (WCAG 1.3.1):
 *   - <nav aria-label="Breadcrumb"> + <ol> structure
 *   - Last item is a non-link <span aria-current="page">
 *   - Separators are aria-hidden (decorative)
 *
 * Mobile collapse: when the trail has more than 3 entries we render
 *   first → ellipsis → last 2
 * to keep the bar one-line on narrow viewports without losing the user's
 * sense of location.
 *
 * Visibility: hidden when the trail has fewer than 2 items (showing
 * "Home" alone is noise).
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { BreadcrumbItem } from './sub-nav.types';

/** Sentinel used in the mobile-collapsed trail to render the ellipsis chip. */
const ELLIPSIS_ITEM: BreadcrumbItem = {
  id: '__ellipsis__',
  label: '…',
};

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (visibleItems().length >= 2) {
      <nav class="ep-bc" aria-label="Breadcrumb">
        <ol class="ep-bc__list" role="list">
          @for (item of visibleItems(); track item.id; let last = $last; let first = $first) {
            <li class="ep-bc__li">
              @if (item.id === ellipsisId) {
                <span class="ep-bc__ellipsis" aria-hidden="true">{{ item.label }}</span>
              } @else if (last || !item.routePath) {
                <span class="ep-bc__current" aria-current="page" [attr.title]="item.label">
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  <span>{{ item.label }}</span>
                </span>
              } @else {
                <a
                  [routerLink]="item.routePath"
                  class="ep-bc__link"
                  [attr.title]="item.label"
                >
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  <span>{{ item.label }}</span>
                </a>
              }
              @if (!last) {
                <span class="ep-bc__sep" aria-hidden="true">/</span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `,
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  /** Auto-generated trail from BreadcrumbService. */
  readonly items = input.required<readonly BreadcrumbItem[]>();
  /** Above this width we show the full trail; below, we collapse middle. */
  readonly collapseAboveCount = input<number>(3);

  protected readonly ellipsisId = ELLIPSIS_ITEM.id;

  /**
   * If trail length > collapseAboveCount, return first + ellipsis + last 2.
   * Otherwise return the trail unchanged.
   */
  protected readonly visibleItems = computed<readonly BreadcrumbItem[]>(() => {
    const all = this.items();
    const cap = this.collapseAboveCount();
    if (all.length <= cap) return all;
    const first = all[0];
    const last2 = all.slice(-2);
    return first ? [first, ELLIPSIS_ITEM, ...last2] : all;
  });
}
