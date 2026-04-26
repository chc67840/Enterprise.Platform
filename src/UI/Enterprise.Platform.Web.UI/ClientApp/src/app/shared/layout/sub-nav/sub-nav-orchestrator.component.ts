/**
 * ─── shared/layout/sub-nav/sub-nav-orchestrator ────────────────────────────────
 *
 * The SINGLE entry point for everything between the navbar and the page
 * content. The app-shell mounts this once; nothing else in the app should
 * mount a banner host, breadcrumb, or page header directly.
 *
 * RENDER ORDER (top to bottom):
 *   1. <app-status-banner-host>  — system / contextual / maintenance banners
 *   2. <app-breadcrumb>          — auto-generated from router data
 *   3. <app-page-header>         — title + subtitle + actions
 *
 * BANNERS — kept generic via StatusBannerService. Domain-specific banner
 * components (impersonation, trial, risk/compliance, market status, etc.)
 * are NOT built today because no underlying system drives them. When such
 * a system lands, add a new <app-* /> render here in the documented
 * priority slot.
 *
 * PAGE HEADER — config sourced with this precedence:
 *   1. PageHeaderService.config()  — page set this dynamically
 *   2. ActivatedRoute.data.pageHeader — declared on the route
 *   3. null                        — header is hidden entirely
 *
 * Action events from the page-header are re-emitted via `(action)` so the
 * app-shell can route them through its existing `onNavAction` dispatcher.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

import type { RouteMetadata } from '@core/models';

import { StatusBannerHostComponent } from '@shared/components/status-banner/status-banner-host.component';

import { BreadcrumbComponent } from './breadcrumb.component';
import { BreadcrumbService } from './breadcrumb.service';
import { PageHeaderComponent } from './page-header.component';
import { PageHeaderService } from './page-header.service';
import type { PageHeaderConfig } from './sub-nav.types';

@Component({
  selector: 'app-sub-nav-orchestrator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StatusBannerHostComponent,
    BreadcrumbComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-status-banner-host />

    <div class="ep-sub-nav__container">
      <app-breadcrumb [items]="breadcrumbItems()" />

      @if (pageHeaderConfig(); as cfg) {
        <app-page-header
          [config]="cfg"
          (action)="action.emit($event)"
        />
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ep-sub-nav__container {
        max-width: var(--ep-content-max);
        margin: 0 auto;
        padding: 0 1rem;
      }
      @media (min-width: 640px) { .ep-sub-nav__container { padding: 0 1.5rem; } }
    `,
  ],
})
export class SubNavOrchestratorComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly pageHeaderService = inject(PageHeaderService);

  /** Re-emitter for page-header `(action)` events. */
  readonly action = output<string>();

  protected readonly breadcrumbItems = this.breadcrumbService.items;

  /**
   * Resolve PageHeaderConfig from route data — recomputed on every
   * NavigationEnd. Walks to the deepest activated route (the actual page
   * component, not its layout wrappers) since that's where pageHeader is
   * usually declared.
   */
  private readonly routeHeaderConfig = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestRouteData()?.pageHeader as PageHeaderConfig | undefined),
      startWith(this.deepestRouteData()?.pageHeader as PageHeaderConfig | undefined),
      takeUntilDestroyed(),
    ),
    { initialValue: undefined as PageHeaderConfig | undefined },
  );

  /** Service override wins over route data (page set it dynamically). */
  protected readonly pageHeaderConfig = computed<PageHeaderConfig | null>(() => {
    return this.pageHeaderService.config() ?? this.routeHeaderConfig() ?? null;
  });

  private deepestRouteData(): RouteMetadata | null {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    return (r.data ?? null) as RouteMetadata | null;
  }
}
