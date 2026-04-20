/**
 * ─── LOGIN COMPONENT ────────────────────────────────────────────────────────────
 *
 * WHY
 *   The single public-facing sign-in screen. Does three things:
 *
 *     1. Offers a "Sign in with Microsoft" button that triggers MSAL's
 *        redirect flow via `AuthService.login(returnUrl)`.
 *
 *     2. Reads the `returnUrl` query param (set by `authGuard` when a
 *        protected route redirected here) so after sign-in the user lands
 *        where they were going.
 *
 *     3. Redirects authenticated users away — if a signed-in user hits
 *        `/auth/login` directly, send them straight to `returnUrl` (or
 *        `/dashboard` as a safe default). Prevents re-login loops.
 *
 * MINIMAL UX
 *   One button. No form. Azure AD owns the credential UX (email, password,
 *   MFA, conditional access). That's a feature, not a limitation: we don't
 *   duplicate input validation, password requirements, forgot-password
 *   flows, etc. — all of that lives in Entra.
 */
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <p class="text-sm text-gray-600">
        Use your Microsoft Entra account to access the platform.
      </p>
      <button
        type="button"
        class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        [disabled]="auth.isLoading()"
        (click)="signIn()"
      >
        @if (auth.isLoading()) {
          <span>Signing in…</span>
        } @else {
          <span>Sign in with Microsoft</span>
        }
      </button>
    </div>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Captured at mount; used when the user clicks the sign-in button. */
  private readonly returnUrl: string = this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';

  constructor() {
    // Reactive redirect: if the auth state flips to authenticated while
    // this page is mounted (e.g. MSAL just processed a redirect), bounce
    // straight to returnUrl. `effect()` re-runs on signal change; zoneless
    // CD makes this synchronous + safe.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.router.navigateByUrl(this.returnUrl);
      }
    });
  }

  signIn(): void {
    this.auth.login(this.returnUrl);
  }
}
