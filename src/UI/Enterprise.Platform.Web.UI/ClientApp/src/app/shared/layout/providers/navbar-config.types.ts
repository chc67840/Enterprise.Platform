/**
 * ─── shared/layout/providers/navbar-config.types ────────────────────────────────
 *
 * Provider abstraction for the active `NavbarConfig` (and its paired
 * `FooterConfig`). The shell never builds chrome configs directly; it asks
 * the provider, which decides whether to:
 *   - return a hard-coded factory (`StaticNavbarConfigProvider`)
 *   - call the BFF (`BackendNavbarConfigProvider`)
 *   - merge a base + per-tenant overlay (custom impl)
 *
 * The provider returns DOMAIN data, not USER data. User identity / roles
 * live on `AuthStore` and are passed into the provider as `context.user` so
 * the BFF impl can include them in the request payload (the BFF, in turn,
 * filters its response per-user — defense in depth: the client also gates
 * via `NavMenuComponent`'s permission check).
 */
import type { Observable } from 'rxjs';

import type { DomainKey } from '../domains';
import type { DomainChromeConfig, UserProfile } from '../models/nav.models';

/** Snapshot of state passed to the provider on every load call. */
export interface NavbarConfigContext {
  /** Active domain id (Finance / Healthcare / HR or future domains). */
  readonly domain: DomainKey;
  /** Current user profile, or `null` when unauthenticated (login page). */
  readonly user: UserProfile | null;
}

/**
 * The contract every provider implements. Returns an Observable so HTTP
 * impls can stream + cancel; static impls return `of(...)` immediately.
 *
 * Errors should propagate via the standard Observable error channel — the
 * service catches them and falls back to its `lastKnown` snapshot or to
 * the boot fallback (whichever exists). Providers should NEVER swallow
 * errors silently; observability matters here.
 */
export interface NavbarConfigProvider {
  load(context: NavbarConfigContext): Observable<DomainChromeConfig>;
}
