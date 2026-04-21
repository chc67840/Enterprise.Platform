/**
 * ─── PageHeaderComponent ────────────────────────────────────────────────────────
 *
 * The standard page chrome used at the top of every feature route: title,
 * optional subtitle, optional breadcrumbs, optional action-button slot.
 *
 * USAGE
 *   ```html
 *   <app-page-header
 *     [title]="'Users'"
 *     [subtitle]="'Manage platform users and their roles.'"
 *     [breadcrumbs]="[{ label: 'Home', url: '/' }, { label: 'Users' }]"
 *   >
 *     <button pButton label="New user" (click)="create()"></button>
 *   </app-page-header>
 *   ```
 *
 * SEMANTICS
 *   - Top-level element is `<header>` so screen readers identify it as a
 *     landmark. Breadcrumbs use `<nav aria-label="Breadcrumb">` + ordered list.
 *   - Actions slot is a plain `<ng-content>` — the caller decides what goes
 *     in there (single button, split button, toolbar).
 *
 * DESIGN
 *   - Title: `text-2xl` + `font-semibold` + neutral-900.
 *   - Subtitle: `text-sm` + neutral-500, wraps nicely on narrow viewports.
 *   - Breadcrumb separator: single `/` with `aria-hidden="true"` so SRs only
 *     announce labels.
 *   - Responsive: on `sm:` + up the actions sit on the right; below that they
 *     wrap under the title.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Breadcrumb {
  /** User-facing label; required. */
  readonly label: string;
  /** Optional router URL. Leaf crumbs usually omit this. */
  readonly url?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        @if (breadcrumbs().length > 0) {
          <nav aria-label="Breadcrumb" class="mb-2">
            <ol class="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
              @for (crumb of breadcrumbs(); track crumb.label; let last = $last) {
                <li class="flex items-center gap-1">
                  @if (crumb.url && !last) {
                    <a
                      [routerLink]="crumb.url"
                      class="hover:text-primary-600"
                      >{{ crumb.label }}</a
                    >
                  } @else {
                    <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
                  }
                  @if (!last) {
                    <span aria-hidden="true" class="text-neutral-300">/</span>
                  }
                </li>
              }
            </ol>
          </nav>
        }

        <h1 class="truncate text-2xl font-semibold tracking-tight text-neutral-900">
          {{ title() }}
        </h1>

        @if (subtitle()) {
          <p class="mt-1 text-sm text-neutral-500">{{ subtitle() }}</p>
        }
      </div>

      <div class="flex flex-shrink-0 items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  /** Required — the page title (usually the feature name). */
  readonly title = input.required<string>();

  /** Optional one-line description under the title. */
  readonly subtitle = input<string | undefined>(undefined);

  /** Optional breadcrumb trail. Render suppressed when empty. */
  readonly breadcrumbs = input<readonly Breadcrumb[]>([]);
}
