/**
 * ─── shared/layout/sub-nav/breadcrumb.service ───────────────────────────────────
 *
 * Auto-generates the breadcrumb trail from the active route tree on every
 * NavigationEnd. Pages NEVER hand-wire breadcrumbs — they declare
 * `data.breadcrumb` in their route definition, and the trail emerges.
 *
 * Source of truth — `RouteMetadata.breadcrumb`:
 *   - `string`                                 — static label
 *   - `(params) => string`                     — derived from URL params
 *   - omitted                                  — segment is skipped
 *
 * The service walks `ActivatedRoute.snapshot.root` → leaf, accumulates URL
 * segments at each depth, and emits a `BreadcrumbItem[]` signal that the
 * BreadcrumbComponent renders. Last item has no `routePath` (it's the
 * current page; should not be a link — WCAG 1.3.1).
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import { filter } from 'rxjs/operators';

import type { RouteMetadata } from '@core/models';

import type { BreadcrumbItem } from './sub-nav.types';

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);

  private readonly _items = signal<readonly BreadcrumbItem[]>([]);
  readonly items = computed(() => this._items());

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.rebuild());

    // Build once on construction so the trail is correct on first render
    // (NavigationEnd has already fired by the time singletons construct
    // via app initializer; do this defensively in case it hasn't).
    this.rebuild();
  }

  /** Walk the activated route tree and rebuild the trail. */
  private rebuild(): void {
    const root = this.router.routerState.snapshot.root;
    const items: BreadcrumbItem[] = [];
    const segments: string[] = [];

    this.walk(root, segments, items);

    /*
     * Last item drops its routePath — the current page must not be a link
     * (WCAG 1.3.1, BreadcrumbComponent renders this as `aria-current="page"`).
     */
    const last = items[items.length - 1];
    if (last) {
      items[items.length - 1] = { ...last, routePath: undefined };
    }

    this._items.set(items);
  }

  private walk(
    snapshot: ActivatedRouteSnapshot,
    segments: string[],
    out: BreadcrumbItem[],
  ): void {
    /*
     * Accumulate URL segments from this snapshot's `url` array. Empty
     * arrays mean a path-less route (e.g. layout wrapper) — its breadcrumb
     * still applies to the accumulated trail above it.
     */
    const segmentsHere = snapshot.url.map((u) => u.path);
    segments.push(...segmentsHere);

    const meta = snapshot.data as Partial<RouteMetadata> | undefined;
    const raw = meta?.breadcrumb;

    if (raw !== undefined) {
      const label = typeof raw === 'function'
        ? raw(snapshot.params as Record<string, string>)
        : raw;
      const route = '/' + segments.filter((s) => s.length > 0).join('/');
      out.push({
        id: route + '#' + label,
        label,
        routePath: route,
      });
    }

    if (snapshot.firstChild) {
      this.walk(snapshot.firstChild, segments, out);
    }
  }
}
