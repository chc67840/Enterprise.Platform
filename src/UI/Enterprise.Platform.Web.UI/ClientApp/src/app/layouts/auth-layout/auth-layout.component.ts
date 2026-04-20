/**
 * ─── AUTH LAYOUT ────────────────────────────────────────────────────────────────
 *
 * WHY
 *   The `/auth/*` route subtree uses a chrome-free layout — no sidebar, no
 *   header, just a centred card. Keeping it in its own layout component (as
 *   opposed to putting the header/sidebar behind an `*ngIf="authenticated"`)
 *   gives us:
 *
 *     1. Clear separation of concerns — auth screens and app screens never
 *        share state or styles.
 *     2. Lighter bundle for unauthenticated users — the `AppShell` code path
 *        (sidebar, top header, toast host) only downloads after sign-in.
 *     3. Clean handoff: after login MSAL redirects to the app shell via
 *        `returnUrl`; the auth layout unmounts completely.
 *
 * STRUCTURE
 *   - Centered card (Tailwind classes) sized for login / forgot-password forms.
 *   - Brand mark at the top.
 *   - `<router-outlet />` for the auth-feature children.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <main class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <header class="mb-8 text-center">
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900">Enterprise Platform</h1>
          <p class="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </header>
        <router-outlet />
      </div>
    </main>
  `,
})
export class AuthLayoutComponent {}
