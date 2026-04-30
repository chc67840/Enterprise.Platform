/**
 * Sidebar state shared across navbar + rail components. Two distinct
 * concerns deliberately kept separate:
 *   - `collapsed` — desktop icons-only mode, persisted in localStorage.
 *   - `mobileOpen` — mobile drawer visibility, NOT persisted (always
 *     defaults closed on each visit).
 *
 * `toggle()` is viewport-aware so callers don't pattern-match the
 * breakpoint themselves. Stays in lock-step with the SCSS media query
 * via `SIDENAV_MOBILE_BREAKPOINT_PX`.
 */
import { Injectable, signal, type Signal } from '@angular/core';

/** Storage key — exported for spec-friendly cleanup. */
export const SIDENAV_COLLAPSED_KEY = 'ep:sidebar:collapsed';

const DEFAULT_COLLAPSED = false;

/** Viewport width below which the sidebar switches to mobile drawer mode. */
export const SIDENAV_MOBILE_BREAKPOINT_PX = 768;

@Injectable({ providedIn: 'root' })
export class SidenavStateService {
  private readonly _collapsed = signal<boolean>(this.readInitial());
  private readonly _mobileOpen = signal<boolean>(false);

  /** Read-only signals — components bind to `service.collapsed()` etc. */
  readonly collapsed: Signal<boolean> = this._collapsed.asReadonly();
  readonly mobileOpen: Signal<boolean> = this._mobileOpen.asReadonly();

  /** Viewport-aware toggle: flips `mobileOpen` on mobile, `collapsed` on desktop. */
  toggle(): void {
    if (this.isMobile()) {
      this._mobileOpen.update((v) => !v);
    } else {
      this.setCollapsed(!this._collapsed());
    }
  }

  setCollapsed(value: boolean): void {
    this._collapsed.set(value);
    this.persist(value);
  }

  closeMobile(): void {
    this._mobileOpen.set(false);
  }

  private isMobile(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(`(max-width: ${SIDENAV_MOBILE_BREAKPOINT_PX}px)`).matches;
  }

  private readInitial(): boolean {
    if (typeof window === 'undefined') return DEFAULT_COLLAPSED;
    try {
      const raw = window.localStorage.getItem(SIDENAV_COLLAPSED_KEY);
      if (raw === '1') return true;
      if (raw === '0') return false;
      return DEFAULT_COLLAPSED;
    } catch {
      return DEFAULT_COLLAPSED;
    }
  }

  private persist(value: boolean): void {
    if (typeof window === 'undefined') return;
    // Storage writes are best-effort — private-mode quotas, disabled
    // storage, or rare SecurityError exceptions shouldn't break the UI.
    try {
      window.localStorage.setItem(SIDENAV_COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      /* swallow */
    }
  }
}
