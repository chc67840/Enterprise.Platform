/**
 * ─── DASHBOARD ──────────────────────────────────────────────────────────────────
 *
 * Phase 1 placeholder — proves auth → shell → route navigation works end to
 * end. Phase 12 replaces this with the real KPI/chart dashboard wired to
 * the stores.
 *
 * Phase-7.6 addition: a "Verify backend" button that calls
 * `GET /api/v1/whoami` to prove the full SPA → Entra → Api chain works:
 *
 *   1. MSAL interceptor attaches the bearer token (from the Entra ID
 *      token obtained at login).
 *   2. Api's `AuthenticationSetup` validates the token against the
 *      AzureAd.Audiences + AllowedIssuers + RequiredScopes configured
 *      in `appsettings.Development.json`.
 *   3. `/api/v1/whoami` returns 200 with the decoded claims, OR the
 *      request fails with a diagnosable status + error body.
 *
 * This is the canonical smoke test when swapping Azure app registrations
 * or rotating tenants — a green round-trip here means every piece of
 * auth wiring is correct.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { API_BASE_URL } from '@core/http/api-config.token';

interface WhoAmIResponse {
  readonly isAuthenticated: boolean;
  readonly name: string | null;
  readonly claimCount: number;
  readonly claims: Readonly<Record<string, string>>;
}

type VerifyState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ok'; readonly response: WhoAmIResponse }
  | {
      readonly status: 'error';
      readonly statusCode: number;
      readonly message: string;
    };

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
                <span
                  class="mr-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                >
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

      <!-- Backend connectivity probe — proves MSAL token → Api validation end-to-end. -->
      <div class="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-gray-900">Verify backend connectivity</div>
            <div class="mt-1 text-xs text-gray-500">
              Calls <code class="text-gray-700">GET {{ whoamiUrl }}</code>. Proves the MSAL
              token flow + Api JWT validation are correctly wired.
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            [disabled]="isLoading()"
            (click)="verifyBackend()"
          >
            @if (isLoading()) {
              Testing…
            } @else {
              Test now
            }
          </button>
        </div>

        @switch (state().status) {
          @case ('ok') {
            <div class="mt-3 rounded-md bg-green-50 p-3 ring-1 ring-green-200">
              <div class="text-sm font-semibold text-green-800">
                ✓ Authenticated — Api returned {{ okClaims().claimCount }} claims
              </div>
              <details class="mt-2 text-xs text-green-900">
                <summary class="cursor-pointer">Show claim dump</summary>
                <pre class="mt-2 max-h-64 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-gray-700">{{ claimsJson() }}</pre>
              </details>
            </div>
          }
          @case ('error') {
            <div class="mt-3 rounded-md bg-red-50 p-3 ring-1 ring-red-200">
              <div class="text-sm font-semibold text-red-800">
                ✗ {{ errorStatus() }} — {{ errorMessage() }}
              </div>
              <div class="mt-1 text-xs text-red-700">
                Common causes: aud/iss mismatch in the Api's AzureAd config, CORS
                blocking the origin, or the Api not running on the expected port.
              </div>
            </div>
          }
        }
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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Exposed for template use — binds `{{ whoamiUrl }}` to the full URL. */
  protected readonly whoamiUrl = `${this.baseUrl}/whoami`;

  protected readonly state = signal<VerifyState>({ status: 'idle' });
  protected readonly isLoading = () => this.state().status === 'loading';

  protected verifyBackend(): void {
    this.state.set({ status: 'loading' });
    this.http.get<WhoAmIResponse>(this.whoamiUrl).subscribe({
      next: (response) => this.state.set({ status: 'ok', response }),
      error: (err: unknown) => {
        const httpErr = err as HttpErrorResponse;
        this.state.set({
          status: 'error',
          statusCode: httpErr.status ?? 0,
          message:
            httpErr.error?.message ??
            httpErr.message ??
            'Unknown error — check the browser Network tab.',
        });
      },
    });
  }

  /** Template helpers — narrow the discriminated state shape for readability. */
  protected okClaims(): WhoAmIResponse {
    const s = this.state();
    return s.status === 'ok' ? s.response : ({ claims: {}, claimCount: 0, name: null, isAuthenticated: false });
  }
  protected claimsJson(): string {
    return JSON.stringify(this.okClaims().claims, null, 2);
  }
  protected errorStatus(): number {
    const s = this.state();
    return s.status === 'error' ? s.statusCode : 0;
  }
  protected errorMessage(): string {
    const s = this.state();
    return s.status === 'error' ? s.message : '';
  }
}
