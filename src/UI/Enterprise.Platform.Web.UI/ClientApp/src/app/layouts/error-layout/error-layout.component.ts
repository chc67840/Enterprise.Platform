/**
 * ─── ERROR LAYOUT ───────────────────────────────────────────────────────────────
 *
 * WHY
 *   Error pages (`/error/forbidden`, `/error/server-error`, `/error/offline`,
 *   `/error/maintenance`) need a lightweight wrapper distinct from both the
 *   main `AppShell` (too heavy — loads sidebar / permissions / stores) and
 *   the `AuthLayout` (implies unauthenticated context). A dedicated layout:
 *
 *     1. Keeps these routes mountable even when the auth state is broken
 *        (e.g. after a 401 loop that leaves no signed-in user).
 *     2. Renders consistent chrome across every error page without each page
 *        repeating the markup.
 *     3. Provides an escape hatch: the "Return home" link is mounted here,
 *        one place to update if the home URL changes.
 *
 * STRUCTURE
 *   Simple full-screen container with a single prominent message card.
 *   Individual error routes pass their content through `<router-outlet />`.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-error-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <main class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div class="w-full max-w-lg">
        <router-outlet />
      </div>
    </main>
  `,
})
export class ErrorLayoutComponent {}
