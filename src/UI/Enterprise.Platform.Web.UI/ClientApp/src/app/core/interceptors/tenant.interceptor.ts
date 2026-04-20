/**
 * ─── TENANT INTERCEPTOR ─────────────────────────────────────────────────────────
 *
 * WHY
 *   The platform is multi-tenant (see backend `TenantFilterBehavior` +
 *   `ICurrentTenantService`). The SPA resolves the caller's active tenant
 *   once at login (via `AuthStore.hydrate()`) and attaches it to every
 *   `/api/` request as `X-Tenant-ID` so the backend can scope reads + writes.
 *
 *   The backend already has tenant resolution strategies that look at:
 *     - JWT `tid` / `tenantId` claim
 *     - `X-Tenant-ID` header  ← this interceptor's contribution
 *     - Subdomain / route segment
 *
 *   Adopting the header path on the client keeps the backend's resolution
 *   logic simple and consistent — no subdomain math, no route parsing.
 *
 * WHAT IT AVOIDS
 *   - Attaches ONLY to calls hitting our API. External calls (MS Graph, CDN
 *     assets) shouldn't leak our tenant id.
 *   - Skips when no tenant is resolved yet (unauthenticated bootstrap calls,
 *     anonymous endpoints).
 *
 * CHAIN POSITION
 *   Position #3, after correlation id — so tenant requests are traceable
 *   from the moment they leave the client.
 */
import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TenantService } from '@core/services/tenant.service';

const TENANT_HEADER = 'X-Tenant-ID';

/** Returns `true` when the URL points at our API (vs MS Graph / CDN / etc.). */
function isPlatformApi(url: string): boolean {
  // Match both absolute and relative URLs. The backend is under `/api/`.
  return url.includes('/api/');
}

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformApi(req.url)) {
    return next(req);
  }

  const tenantId = inject(TenantService).current();
  if (!tenantId) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [TENANT_HEADER]: tenantId } }));
};
