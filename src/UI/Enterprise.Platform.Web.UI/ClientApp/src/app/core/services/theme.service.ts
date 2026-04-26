/**
 * ─── THEME SERVICE ─────────────────────────────────────────────────────────────
 *
 * WHY
 *   The shell needs a single source of truth for "is the app in light or dark
 *   mode?" so the user-menu toggle, the OS-preference watcher, and PrimeNG's
 *   `darkModeSelector: '.dark'` all agree. Pushing this into `<html>` (the
 *   element PrimeNG observes) means the design tokens in `tokens.css` flip
 *   atomically with the PrimeNG component palette — no half-themed flash.
 *
 * MODES
 *   - `'light'`  — force light, ignore OS.
 *   - `'dark'`   — force dark, ignore OS.
 *   - `'system'` — track `prefers-color-scheme: dark`. This is the default
 *                  because it's the least surprising for first-time visitors
 *                  and the only mode that "respects accessibility" out of
 *                  the box (high-contrast users typically already have an
 *                  OS-level dark preference).
 *
 * PERSISTENCE
 *   The user's chosen mode is saved to `localStorage` under `THEME_KEY`. The
 *   *resolved* `isDark()` signal is what templates bind to; `mode()` is what
 *   the toggle reads. The split prevents a UI bug where templates re-render
 *   on every system-preference flicker — they only re-render when the
 *   resolved value actually changes.
 *
 * SSR / NON-DOM HOSTS
 *   `window.matchMedia` and `localStorage` are guarded — calling this from a
 *   non-DOM environment (server render, unit-test JSDOM with disabled
 *   matchMedia) silently no-ops on the OS-tracking branch.
 */
import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

import { STORAGE_KEYS } from '@constants';

import { LoggerService } from './logger.service';

/** localStorage key for the user's preferred mode. */
const THEME_KEY = STORAGE_KEYS.THEME;

/** CSS class added to `<html>` when dark mode is active. Matches PrimeNG config. */
const DARK_CLASS = 'dark';

/** Three discrete modes the user can choose from in the UI toggle. */
export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly log = inject(LoggerService);

  /**
   * The user's selected mode. Reading from localStorage upfront means the
   * very first paint already has the right class on `<html>` (we apply it
   * synchronously in the constructor below).
   */
  private readonly _mode = signal<ThemeMode>(this.readStored());

  /** OS preference snapshot — flipped by the matchMedia listener. */
  private readonly _systemPrefersDark = signal<boolean>(this.readSystemPreference());

  /** Public read-only mode signal — components bind to this for their toggle UI. */
  readonly mode = this._mode.asReadonly();

  /**
   * Resolved boolean — `true` when the app should render in dark mode.
   * Computed so consumers re-render only on transitions, not on every
   * `_systemPrefersDark` blip when `mode === 'light'/'dark'`.
   */
  readonly isDark = computed<boolean>(() => {
    const mode = this._mode();
    if (mode === 'system') return this._systemPrefersDark();
    return mode === 'dark';
  });

  /** Convenience inverse for templates. */
  readonly isLight = computed<boolean>(() => !this.isDark());

  constructor() {
    this.subscribeToSystemPreference();

    // Apply the resolved class on `<html>` whenever `isDark` flips. Effect
    // runs eagerly on construction, so the initial paint is correct.
    effect(() => {
      const dark = this.isDark();
      const root = this.doc.documentElement;
      if (dark) {
        root.classList.add(DARK_CLASS);
      } else {
        root.classList.remove(DARK_CLASS);
      }
    });
  }

  /** Sets a specific mode and persists it. */
  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
    this.writeStored(mode);
    this.log.info('theme.mode.changed', { mode });
  }

  /**
   * Cycles the explicit modes the way most apps do: `light → dark → system →
   * light → …`. Avoids a binary toggle that strands users in 'system' mode
   * with no obvious way out.
   */
  cycle(): void {
    const next: ThemeMode =
      this._mode() === 'light' ? 'dark' : this._mode() === 'dark' ? 'system' : 'light';
    this.setMode(next);
  }

  /** Binary toggle — useful for keyboard shortcuts that should ignore 'system'. */
  toggleDark(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  private readStored(): ThemeMode {
    try {
      const raw = this.doc.defaultView?.localStorage?.getItem(THEME_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    } catch {
      // localStorage may throw in privacy-strict browser modes — ignore.
    }
    return 'system';
  }

  private writeStored(mode: ThemeMode): void {
    try {
      this.doc.defaultView?.localStorage?.setItem(THEME_KEY, mode);
    } catch {
      // Same defensive try as above — persistence is best-effort, not required.
    }
  }

  private readSystemPreference(): boolean {
    const mql = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    return mql?.matches ?? false;
  }

  private subscribeToSystemPreference(): void {
    const mql = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mql) return;
    // `addEventListener('change', …)` is the modern API. Older Safari only
    // exposed `addListener` — in 2026 every supported browser supports the
    // EventTarget contract, so we no longer need the fallback.
    mql.addEventListener('change', (e) => this._systemPrefersDark.set(e.matches));
  }
}
