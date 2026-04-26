/**
 * ─── STATUS BANNER SERVICE ──────────────────────────────────────────────────────
 *
 * WHY
 *   The chrome between the top-nav and the main content has to surface
 *   business / system state that doesn't belong in a toast: scheduled
 *   maintenance windows, compliance notices ("you're viewing PHI"), tenant
 *   read-only mode, beta-feature flags, connectivity loss, retention
 *   reminders, etc. These are persistent context, not transient feedback —
 *   `MessageService` (toast) is the wrong tool.
 *
 *   This service is the **single registry** that any feature can push into.
 *   The single host (`StatusBannerHostComponent`) renders whatever's in the
 *   registry. Adding a new banner anywhere in the app is one line:
 *
 *     ```ts
 *     banners.push({
 *       id: 'maintenance-2026-05-01',
 *       severity: 'maintenance',
 *       title: 'Scheduled maintenance Sunday 02:00 UTC',
 *       message: 'Saves are disabled between 02:00 – 03:00 UTC.',
 *       dismissable: true,
 *       dismissPersist: true,
 *     });
 *     ```
 *
 * SEVERITIES
 *   - `info`         — neutral context (e.g. "you are viewing the audit trail")
 *   - `success`      — confirmed system state (e.g. "all services healthy")
 *   - `warning`      — soft heads-up (e.g. "trial expires in 7 days")
 *   - `danger`       — failed state (e.g. "billing past due — saves blocked")
 *   - `maintenance`  — operational notice (e.g. scheduled window)
 *
 *   Each severity drives a brand-token palette (per UI-Color-Palette-Strategy)
 *   AND an ARIA role (`status` for info/success/maintenance, `alert` for
 *   warning/danger) so screen readers announce the right urgency.
 *
 * DISMISS PERSISTENCE
 *   When `dismissPersist: true`, a dismissed banner's id is written to
 *   `localStorage` so the user doesn't see it again across sessions. Use this
 *   for one-time announcements; leave it false for recurring system state
 *   that should re-appear if the condition reappears.
 *
 *   The persistence is best-effort — we swallow `localStorage` errors (Safari
 *   private mode, storage quotas) so a failed write never breaks the UI.
 */
import { Injectable, computed, signal } from '@angular/core';

/** Severity drives both visual treatment AND ARIA live-region behavior. */
export type StatusBannerSeverity =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'maintenance';

/** Optional CTA rendered next to the banner message. */
export interface StatusBannerAction {
  /** Button label. */
  readonly label: string;
  /** Click handler — typically opens a route, dialog, or external doc. */
  readonly invoke: () => void;
}

/**
 * One row in the banner registry. `id` is the dedupe key — pushing a banner
 * with an existing id replaces the previous entry rather than stacking
 * duplicates.
 */
export interface StatusBanner {
  /** Stable id (drives `track`, dedupe, and dismiss-persistence). */
  readonly id: string;

  readonly severity: StatusBannerSeverity;

  /** Bold prefix (one short sentence). */
  readonly title: string;

  /** Body copy (may be longer; UI does not truncate). */
  readonly message: string;

  /**
   * When true, render an X button. Dismissed banners are removed from the
   * registry (and persisted, see {@link dismissPersist}).
   */
  readonly dismissable?: boolean;

  /**
   * When true AND dismissable, the dismissed id is written to `localStorage`
   * so subsequent sessions don't show it again. Use sparingly — most banners
   * should re-appear if the condition recurs.
   */
  readonly dismissPersist?: boolean;

  /** Optional CTA. */
  readonly action?: StatusBannerAction;

  /**
   * Override the default PrimeIcons class for this severity. Defaults are
   * picked by the host component; this lets a feature use a domain-specific
   * icon (e.g. `pi pi-shield` for a compliance notice).
   */
  readonly icon?: string;
}

const DISMISS_STORAGE_KEY = 'ep:status-banner:dismissed';

@Injectable({ providedIn: 'root' })
export class StatusBannerService {
  /** Internal source-of-truth — keyed by id, ordered by insertion. */
  private readonly _registry = signal<readonly StatusBanner[]>([]);

  /** Persisted dismissed-ids loaded once at startup. */
  private readonly _dismissedIds = new Set<string>(this.loadDismissedIds());

  /**
   * Banners visible to the host. Filters out anything in the persisted
   * dismiss-list so the same banner isn't re-shown after the user dismissed
   * it once. Stable order = insertion order.
   */
  readonly banners = computed<readonly StatusBanner[]>(() =>
    this._registry().filter((b) => !this._dismissedIds.has(b.id)),
  );

  /**
   * Adds or replaces a banner. Banners are de-duplicated by `id` — if a
   * caller pushes the same id twice, only the latest copy is kept (useful
   * for re-rendering with updated content).
   */
  push(banner: StatusBanner): void {
    const next = this._registry().filter((b) => b.id !== banner.id);
    this._registry.set([...next, banner]);
  }

  /** Removes a banner by id. Called by the host's X button + by features that conditionally clear. */
  dismiss(id: string): void {
    const banner = this._registry().find((b) => b.id === id);
    this._registry.set(this._registry().filter((b) => b.id !== id));

    if (banner?.dismissPersist) {
      this._dismissedIds.add(id);
      this.saveDismissedIds();
    }
  }

  /** Removes every banner. Used by tests and on auth state change (sign-out). */
  clear(): void {
    this._registry.set([]);
  }

  /**
   * Resets the persisted-dismissals registry. Useful from a "reset
   * preferences" admin action; not exposed in normal UI.
   */
  resetDismissed(): void {
    this._dismissedIds.clear();
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch {
      // Storage unavailable (Safari private mode etc.) — no-op.
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private loadDismissedIds(): readonly string[] {
    try {
      const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private saveDismissedIds(): void {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...this._dismissedIds]));
    } catch {
      // Storage unavailable — banner stays dismissed in-memory for this session only.
    }
  }
}
