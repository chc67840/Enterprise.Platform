/**
 * ─── shared/layout/providers/backend-navbar-config.provider ─────────────────────
 *
 * Production `NavbarConfigProvider` — fetches the active user's chrome from
 * the BFF. Drop-in swap for `StaticNavbarConfigProvider` via the
 * `NAVBAR_CONFIG_PROVIDER` injection token in `app.config.ts`.
 *
 * BFF CONTRACT (target endpoint, swap when ready):
 *
 *   GET /api/proxy/v1/me/chrome?domain=finance
 *
 *   Response 200:
 *     {
 *       "navbar": NavbarConfig,
 *       "footer": FooterConfig
 *     }
 *
 *   The BFF MUST already have applied the user's RBAC + feature flags —
 *   only items the user is permitted to see should appear in the response.
 *   The client still re-applies its own gating in `NavMenuComponent` as
 *   defense-in-depth (a tampered response from a compromised BFF, or a
 *   stale cached payload during a permission-revocation event, both stay
 *   safe behind the second filter).
 *
 *   On 401 / 403 / 5xx the Observable errors; `NavbarConfigService` falls
 *   back to its last-known config or to `DOMAIN_CHROME_REGISTRY[domain]`.
 *
 * MOCK MODE
 *   The endpoint doesn't exist yet. When the response is a 404 the provider
 *   transparently substitutes the matching static config so we get the
 *   exact "production code path" exercised end-to-end without breaking
 *   local dev. Remove the fallback once the BFF endpoint ships.
 */
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, of, throwError } from 'rxjs';

import { API_BASE_URL } from '@core/http/api-config.token';

import { DOMAIN_CHROME_REGISTRY } from '../domains';
import type { DomainChromeConfig } from '../models/nav.models';
import type { NavbarConfigContext, NavbarConfigProvider } from './navbar-config.types';

@Injectable({ providedIn: 'root' })
export class BackendNavbarConfigProvider implements NavbarConfigProvider {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  load(context: NavbarConfigContext): Observable<DomainChromeConfig> {
    if (!context.user) {
      // No user → no point calling the BFF; show the static unauthenticated
      // config (e.g. a marketing nav). Today every domain renders the same
      // chrome regardless of auth so we just return the static.
      return of(DOMAIN_CHROME_REGISTRY[context.domain]);
    }

    const params = new HttpParams().set('domain', context.domain);
    return this.http
      .get<DomainChromeConfig>(`${this.baseUrl}/me/chrome`, { params })
      .pipe(
        // The eventual endpoint MUST emit the full DomainChromeConfig shape;
        // until then the BFF returns 404 and we fall back to the static map.
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            return of(DOMAIN_CHROME_REGISTRY[context.domain]);
          }
          return throwError(() => err);
        }),
        map((cfg) => cfg ?? DOMAIN_CHROME_REGISTRY[context.domain]),
      );
  }
}
