/**
 * ─── shared/layout/sub-nav/page-header.service ──────────────────────────────────
 *
 * Per-page mutable PageHeaderConfig override. Pages inject this and call
 * `set(config)` when the header content depends on async-resolved data
 * (entity name from the API, computed counts, derived state).
 *
 * The orchestrator merges sources with this precedence:
 *
 *   1. service.config()  — feature page set this dynamically  (HIGHEST)
 *   2. route.data.pageHeader — declared on the route          (DEFAULT)
 *   3. null              — orchestrator hides the page-header (NONE)
 *
 * The service is auto-cleared on every NavigationEnd so a stale header
 * from the previous route can't bleed into the new one. Pages that need
 * the header must re-set it after navigation (typically in `ngOnInit` or
 * inside the resolver subscription).
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import type { PageHeaderConfig } from './sub-nav.types';

@Injectable({ providedIn: 'root' })
export class PageHeaderService {
  private readonly router = inject(Router);

  private readonly _config = signal<PageHeaderConfig | null>(null);
  /** Public read — null means "no page-level override; orchestrator may use route data". */
  readonly config = computed(() => this._config());

  constructor() {
    /*
     * Auto-clear on navigation start. NavigationStart (not NavigationEnd)
     * because we want the override gone BEFORE the new page mounts,
     * preventing a one-frame flash of the old header on the new page.
     */
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this._config.set(null));
  }

  /** Replace the active per-page header config. */
  set(config: PageHeaderConfig): void {
    this._config.set(config);
  }

  /** Patch a subset of the current config (e.g. flip primaryAction.loading). */
  patch(partial: Partial<PageHeaderConfig>): void {
    const current = this._config();
    if (!current) return;
    this._config.set({ ...current, ...partial });
  }

  /** Explicit clear — typically not needed since navigation auto-clears. */
  clear(): void {
    this._config.set(null);
  }
}
