/**
 * ─── core/services/domain.store.ts ──────────────────────────────────────────────
 *
 * Global signal store for the active product domain (Finance / Healthcare / HR).
 * The shell binds the navbar + footer config to `currentDomain()` so a single
 * code base serves all three verticals without rebuild.
 *
 * Persistence: last-active domain written to `localStorage` so a reload
 * doesn't bounce the user back to the default. Useful for QA / demo /
 * customer-success workflows that hop between verticals.
 */
import { Injectable, computed, signal } from '@angular/core';

import type { DomainKey } from '@shared/layout/domains';

const STORAGE_KEY = 'ep:active-domain';
const DEFAULT_DOMAIN: DomainKey = 'finance';

@Injectable({ providedIn: 'root' })
export class DomainStore {
  private readonly _current = signal<DomainKey>(this.loadInitial());

  /** Active domain id. Drives navbar/footer config selection in the shell. */
  readonly currentDomain = computed<DomainKey>(() => this._current());

  /** Switch to a different domain. Persists for the next reload. */
  setDomain(domain: DomainKey): void {
    if (domain === this._current()) return;
    this._current.set(domain);
    this.persist(domain);
  }

  // ── localStorage helpers (best-effort) ───────────────────────────────────

  private loadInitial(): DomainKey {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as DomainKey | null;
      if (raw === 'finance' || raw === 'healthcare' || raw === 'hr') {
        return raw;
      }
    } catch {
      // No-op — fall through to default.
    }
    return DEFAULT_DOMAIN;
  }

  private persist(domain: DomainKey): void {
    try {
      localStorage.setItem(STORAGE_KEY, domain);
    } catch {
      // No-op — Safari private mode etc.
    }
  }
}
