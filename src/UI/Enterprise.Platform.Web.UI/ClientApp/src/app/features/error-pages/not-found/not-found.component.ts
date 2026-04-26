/**
 * ─── 404 NOT FOUND ──────────────────────────────────────────────────────────────
 *
 * Mounted under the `**` catch-all route — any URL the router can't match
 * renders here. Unlike the other error pages, this one doesn't need an
 * explicit navigation trigger; it's a passive fallback.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  /*
   * Title + primary CTA live in the SubNavOrchestrator's <app-page-header>
   * (declared via route data.pageHeader). Page body shows the 404 glyph
   * and a verbose recovery hint — no duplicate <h1> per WCAG 2.4.6.
   */
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 text-6xl font-bold tracking-tight text-gray-300" aria-hidden="true">
        404
      </div>
      <p class="text-sm text-gray-600">
        Check the URL for typos, or
        <a routerLink="/" class="font-medium text-blue-700 hover:underline">return home</a>
        to start over.
      </p>
    </div>
  `,
})
export class NotFoundComponent {}
