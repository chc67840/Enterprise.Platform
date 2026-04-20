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
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 text-6xl font-bold tracking-tight text-gray-300">404</div>
      <h1 class="text-xl font-semibold tracking-tight text-gray-900">Page not found</h1>
      <p class="mt-2 text-sm text-gray-600">
        The URL you followed doesn't match any route in this app.
      </p>
      <a
        routerLink="/"
        class="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        Return home
      </a>
    </div>
  `,
})
export class NotFoundComponent {}
