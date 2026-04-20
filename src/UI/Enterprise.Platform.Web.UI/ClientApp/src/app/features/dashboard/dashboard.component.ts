/**
 * ─── DASHBOARD ──────────────────────────────────────────────────────────────────
 *
 * Phase 1 placeholder — proves auth → shell → route navigation works end to
 * end. Phase 12 replaces this with the real KPI/chart dashboard wired to
 * the stores.
 *
 * For now it:
 *   - Confirms the user is signed in by displaying their name.
 *   - Lists what Phase 1 delivers (so reviewers can see what's wired).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header>
        <h2 class="text-2xl font-semibold tracking-tight text-gray-900">
          Welcome, {{ auth.displayName() || auth.email() }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">Phase 1 scaffold — stabilization complete.</p>
      </header>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Roles</div>
          <div class="mt-2 text-sm text-gray-900">
            @if (authStore.roles().length) {
              @for (role of authStore.roles(); track role) {
                <span class="mr-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {{ role }}
                </span>
              }
            } @else {
              <em class="text-gray-400">None assigned</em>
            }
          </div>
        </div>
        <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div class="text-xs font-medium uppercase tracking-wider text-gray-500">Permissions</div>
          <div class="mt-2 text-sm text-gray-900">
            {{ authStore.permissions().length }} effective
            @if (authStore.bypass()) {
              <span class="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                bypass
              </span>
            }
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Real KPIs, charts, and feature modules land in Phase 12.
        <br />
        See <code class="text-gray-700">Docs/Implementation/UI-Foundation-TODO.md</code>.
      </div>
    </section>
  `,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  readonly authStore = inject(AuthStore);
}
