/**
 * ─── core/services/navbar-config.service ────────────────────────────────────────
 *
 * Signal-backed source of truth for the active `ChromeConfig`. Hydrated once
 * by `AuthService.refreshSession()` after the BFF returns the post-login
 * `SessionInfo` envelope (which carries `chrome` alongside identity +
 * permissions).
 *
 * STATE
 *   - `loading()`     — true until the first hydrate() call lands (success or fallback)
 *   - `error()`       — last hydration error (null on success)
 *   - `lastKnown()`   — last successfully hydrated config — kept across
 *                       transient errors so the SPA never flickers empty chrome
 *   - `chrome()` / `navbar()` / `footer()` — current view; falls back to
 *                       `STATIC_FALLBACK_CHROME` until the first real hydrate
 *
 * PRINCIPLE
 *   This service is a pure cache — no HTTP, no DI on AuthService / AuthStore /
 *   DomainStore. The shell injects only this service; whoever holds the
 *   session response (today: `AuthService`) hands it config via `hydrate()`.
 *   That keeps the dependency arrows acyclic and keeps the chrome path
 *   reactive to a single concrete event ("session loaded").
 */
import { Injectable, computed, signal } from '@angular/core';

import {
  MINIMAL_FALLBACK_CHROME,
  STATIC_FALLBACK_CHROME,
} from '@shared/layout/chrome-fallback';
import type {
  ChromeConfig,
  FooterConfig,
  NavbarConfig,
} from '@shared/layout/models/nav.models';

@Injectable({ providedIn: 'root' })
export class NavbarConfigService {
  // ── state signals ──────────────────────────────────────────────────────

  /** First load in flight. Toggles to false after the first hydrate (success or fallback). */
  readonly loading = signal<boolean>(true);

  /** Last hydration error; null when most recent hydrate succeeded. */
  readonly error = signal<unknown | null>(null);

  /** Last successfully hydrated config — survives transient errors as the fallback. */
  private readonly _lastKnown = signal<ChromeConfig | null>(null);

  /** Public read of the lastKnown snapshot — needed by the shell to detect cold-boot vs warm-error. */
  readonly lastKnown = computed<ChromeConfig | null>(() => this._lastKnown());

  /**
   * Current chrome — prefers the last successful hydrate; falls back to the
   * static config until the first real response lands; falls back to the
   * minimal "safe chrome" only when an error fires AND no lastKnown exists.
   */
  readonly chrome = computed<ChromeConfig>(() => {
    const fresh = this._lastKnown();
    if (fresh) return fresh;
    if (this.error()) return MINIMAL_FALLBACK_CHROME;
    return STATIC_FALLBACK_CHROME;
  });

  readonly navbar = computed<NavbarConfig>(() => this.chrome().navbar);
  readonly footer = computed<FooterConfig>(() => this.chrome().footer);

  // ── mutators ───────────────────────────────────────────────────────────

  /**
   * Push a fresh chrome config in. Called by `AuthService.refreshSession()`
   * with the `chrome` field off the BFF's `SessionInfo` response.
   *
   * Pass `null` when the session is anonymous OR the response had no chrome
   * (the SPA renders the login page in that case so the static fallback is
   * unused but still wired in case a route renders the shell pre-auth).
   */
  hydrate(config: ChromeConfig | null | undefined): void {
    if (config) {
      this._lastKnown.set(config);
      this.error.set(null);
    }
    this.loading.set(false);
  }

  /**
   * Mark a hydration failure. Keeps the lastKnown snapshot if there is one
   * (so the shell renders stale-but-valid chrome rather than flickering to
   * the static fallback) and surfaces the error so the shell can show a
   * status banner with a retry affordance.
   */
  markError(err: unknown): void {
    this.error.set(err);
    this.loading.set(false);
  }

  /** Drop all state — used by `AuthService.logout()` so the next login boot starts clean. */
  reset(): void {
    this._lastKnown.set(null);
    this.error.set(null);
    this.loading.set(true);
  }
}
