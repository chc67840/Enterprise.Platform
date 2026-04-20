/**
 * ─── MAINTENANCE ────────────────────────────────────────────────────────────────
 *
 * Shown when the backend reports planned maintenance. Typically reached by
 * the error interceptor noticing a 503 with a maintenance-specific code,
 * or by a runtime-config flag (`maintenanceMode: true`) routed here via a
 * top-level guard.
 *
 * Wiring the actual detection lands in Phase 2 (runtime config) + Phase 3
 * (error handler). The page exists now so routes + links are complete.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 p-3 text-blue-600">
        <!-- prettier-ignore -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437"/></svg>
      </div>
      <h1 class="text-xl font-semibold tracking-tight text-gray-900">
        We'll be back shortly
      </h1>
      <p class="mt-2 text-sm text-gray-600">
        The platform is undergoing scheduled maintenance. Please try again in a few minutes.
      </p>
    </div>
  `,
})
export class MaintenanceComponent {}
