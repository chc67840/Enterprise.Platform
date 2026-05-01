/**
 * ─── AUTH LAYOUT ────────────────────────────────────────────────────────────────
 *
 * Thin wrapper around the `/auth/*` route subtree — paints the page
 * background + centres the routed child. Brand/product copy lives inside
 * the routed component (e.g. `LoginComponent`) so it's config-driven
 * (`LoginPageConfig.brand`) instead of hardcoded here.
 *
 * Keeping this layout chrome-free (no `.ep-app-shell`, no navbar, no
 * footer) means unauthenticated users never download the post-auth chrome
 * bundle — bytes that aren't reachable until sign-in succeeds.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <main class="ep-auth-layout" role="main">
      <div class="ep-auth-layout__viewport">
        <router-outlet />
      </div>
    </main>
  `,
  styles: [`
    /*
     * Full-viewport surface painted with the brand-subtle gradient so the
     * sign-in card reads as floating. min-height:100dvh (not 100vh) keeps
     * mobile Safari's collapsing toolbar from clipping the bottom edge.
     */
    .ep-auth-layout {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 1.5rem;
      background: var(--ep-gradient-brand-subtle);
    }
    .ep-auth-layout__viewport {
      width: 100%;
      max-width: 32rem;
    }
  `],
})
export class AuthLayoutComponent {}
