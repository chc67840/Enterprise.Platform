/**
 * ─── core/services/focus-management ─────────────────────────────────────────────
 *
 * Moves keyboard focus to `<main id="main-content">` after every successful
 * route navigation. WCAG 2.4.3 — without this, screen readers stay on the
 * previously focused element on the OLD page after an Angular SPA route
 * change, so users hear nothing about the new content until they tab.
 *
 * Implementation notes:
 *
 * 1. `preventScroll: true` is critical — Angular Router's
 *    `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`
 *    handles scroll position. If we let `.focus()` scroll the element into
 *    view, the two systems fight and the page jitters.
 *
 * 2. Filtered to `NavigationEnd` only. NavigationStart fires too early
 *    (the router-outlet hasn't rendered the new component yet); navigation
 *    cancel/error events shouldn't move focus.
 *
 * 3. `tabindex="-1"` on `<main>` makes it programmatically focusable
 *    without putting it in the natural tab order — that attribute lives
 *    in the app-shell template.
 *
 * 4. `queueMicrotask` defers the focus call until after the current
 *    rendering microtask, so the new view's first focusable element
 *    is in the DOM. Without this we race the router-outlet swap.
 */
import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class FocusManagementService {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  /**
   * Hooked from an APP_INITIALIZER so the subscription starts before the
   * first navigation completes. Idempotent — calling twice is a no-op
   * (takeUntilDestroyed handles the lifecycle for the singleton).
   */
  init(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const main = this.doc.getElementById('main-content');
        if (!main) return;
        // queueMicrotask: wait one tick so the router-outlet swap has
        // populated the new view before we try to focus inside it.
        queueMicrotask(() => main.focus({ preventScroll: true }));
      });
  }
}
