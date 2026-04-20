/**
 * ─── FORBIDDEN (403) ────────────────────────────────────────────────────────────
 *
 * Shown when `permissionGuard` / `roleGuard` denies activation, or when the
 * `errorInterceptor` routes the user here after a 403 response. The message
 * is deliberately short on detail — leaking the specific missing permission
 * is a minor information disclosure.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="rounded-xl bg-white p-8 text-center shadow-lg ring-1 ring-gray-200">
      <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 p-3 text-red-600">
        <!-- prettier-ignore -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
      </div>
      <h1 class="text-xl font-semibold tracking-tight text-gray-900">Access denied</h1>
      <p class="mt-2 text-sm text-gray-600">
        You don't have permission to view this resource. If you believe this is an error, contact
        your administrator.
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
export class ForbiddenComponent {}
