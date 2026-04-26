/**
 * ─── shared/layout/providers/static-navbar-config.provider ──────────────────────
 *
 * Default `NavbarConfigProvider` — looks up the active domain in the
 * `DOMAIN_CHROME_REGISTRY` and returns the static factory output. No HTTP,
 * no async work; perfect for unit tests, dev builds, and offline / loading
 * fallback in the BFF-driven path.
 *
 * Permission filtering is NOT done here — the renderer (`NavMenuComponent`)
 * applies the per-user gating. This provider is pure DOMAIN-shape data.
 */
import { Injectable } from '@angular/core';
import { type Observable, of } from 'rxjs';

import { DOMAIN_CHROME_REGISTRY } from '../domains';
import type { DomainChromeConfig } from '../models/nav.models';
import type { NavbarConfigContext, NavbarConfigProvider } from './navbar-config.types';

@Injectable({ providedIn: 'root' })
export class StaticNavbarConfigProvider implements NavbarConfigProvider {
  load(context: NavbarConfigContext): Observable<DomainChromeConfig> {
    return of(DOMAIN_CHROME_REGISTRY[context.domain]);
  }
}
