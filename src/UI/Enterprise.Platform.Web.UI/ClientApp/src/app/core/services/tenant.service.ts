/**
 * ─── TENANT SERVICE ─────────────────────────────────────────────────────────────
 *
 * WHY
 *   A single source of truth for the caller's active tenant id. Consumed by:
 *
 *     - `tenantInterceptor` — attaches `X-Tenant-ID: <id>` to every `/api/`
 *       request so the backend's `TenantFilterBehavior` can scope reads + writes.
 *     - Feature stores / components that want to display the current tenant
 *       (e.g. in the top header).
 *
 * HOW IT RESOLVES THE TENANT
 *   Phase 1: hydrated from `AuthStore.tenantId()` (set by the
 *   `/me/permissions` response). The backend is authoritative; the UI is a
 *   display + transport concern.
 *
 *   A future multi-tenant UX may add a "tenant switcher" that calls
 *   `setTenant(id)` — but only for users whose effective permissions include
 *   cross-tenant access. That wiring lands whenever the product needs it.
 *
 * DESIGN NOTES
 *   - Signal-backed so zoneless CD works naturally + the interceptor reads the
 *     current value on each request without subscribing.
 *   - `null` is a valid state — unauthenticated / anonymous requests have no
 *     tenant, and the interceptor simply omits the header rather than sending
 *     an empty value.
 */
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantService {
  /** Active platform tenant id. `null` when no user is authenticated or the user is unscoped. */
  private readonly _tenantId = signal<string | null>(null);

  /** Read-only signal exposed to consumers. */
  readonly tenantId = this._tenantId.asReadonly();

  /**
   * Updates the active tenant. Called internally by `AuthStore.hydrate()`
   * when the backend returns an effective tenant id.
   */
  setTenant(tenantId: string | null): void {
    this._tenantId.set(tenantId);
  }

  /** Snapshot-style getter for interceptors that need a plain value. */
  current(): string | null {
    return this._tenantId();
  }
}
