/**
 * ─── AUTH STORE ─────────────────────────────────────────────────────────────────
 *
 * WHY
 *   Effective permissions are authoritative authorization data, fetched from
 *   the backend's `GET /api/v1/me/permissions`. They are distinct from:
 *
 *     - MSAL `AccountInfo` (raw token metadata — lives in `AuthService`)
 *     - Id-token `roles` claim (coarse labels, useful but not authoritative)
 *
 *   Keeping them in their own NGRX Signals store lets:
 *
 *     1. Guards (`permissionGuard`, `roleGuard`, `anyPermissionGuard`) read a
 *        single source of truth via `inject(AuthStore).permissions()`.
 *     2. Structural directives (`*appHasPermission`) react to hydration
 *        automatically — the signal graph recomputes once data arrives.
 *     3. The `bypass` flag live in one well-known place (instead of the
 *        previous `'super:admin'` magic-string bypass which was un-auditable
 *        and un-revocable without a client release).
 *
 * STATE LIFECYCLE
 *   initial    → no user, no data
 *     ↓ AuthService detects login
 *   loading    → `hydrate()` in flight
 *     ↓ 200 OK
 *   loaded     → `permissions() / roles() / bypass()` authoritative
 *     ↓ hydrateTtl expires / user logs out
 *   stale/reset → re-hydrate next check, or cleared on logout
 *
 * WHY `signalStore` (not a plain service)
 *   - Batteries-included: loading / error / data in one composable unit.
 *   - Interop with NGRX Signals ecosystem (devtools in Phase 6.2.4).
 *   - Consistent with every feature store so reviewers see one pattern.
 *
 * WHY `providedIn: 'root'`
 *   Permissions are app-wide; one instance is correct. (Feature stores use
 *   route-scoped provision; auth state is the global exception.)
 */
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

import type { EffectivePermissions } from '@core/models';
import { LoggerService } from '@core/services/logger.service';

/**
 * BFF-owned permissions endpoint. Until D4 lifts the BFF returns a placeholder
 * payload (roles from session claims, empty fine-grained permissions). Lives on
 * the BFF — not behind the proxy — so the SPA never round-trips through the Api
 * just to read its own session-derived data.
 */
const PERMISSIONS_ENDPOINT = '/api/auth/me/permissions';

/**
 * Internal state shape. Fields mirror `EffectivePermissions` plus async-state
 * markers (`loading` / `error`) consumed by guards + telemetry.
 */
interface AuthState {
  /** Coarse role labels (mirror of id-token `roles` claim). */
  readonly roles: readonly string[];

  /** Fine-grained permission strings (`<resource>:<action>`). */
  readonly permissions: readonly string[];

  /** Server-granted bypass flag. When `true`, all permission checks pass. */
  readonly bypass: boolean;

  /** Epoch milliseconds at which the current data becomes stale. 0 = never loaded. */
  readonly expiresAt: number;

  /** In-flight flag — `true` while `hydrate()` is running. */
  readonly loading: boolean;

  /** Last error message (if hydration failed). `null` on success. */
  readonly error: string | null;
}

const INITIAL_STATE: AuthState = {
  roles: [],
  permissions: [],
  bypass: false,
  expiresAt: 0,
  loading: false,
  error: null,
};

/**
 * Default server-side TTL when the response omits `ttlSeconds`. Matches the
 * backend's `MemoryCache.DefaultSlidingExpiration` for `/me/permissions`.
 */
const DEFAULT_TTL_SECONDS = 300;

/**
 * `AuthStore` — the single source of truth for effective authorization data.
 *
 * Exposed signals (computed where useful):
 *   - `roles()`, `permissions()`, `bypass()` — raw state
 *   - `isStale()` — `now >= expiresAt`; guards re-hydrate on true
 *   - `hasAnyPermission(...)`, `hasAllPermissions(...)`, `hasRole(...)` — helpers
 *
 * Methods:
 *   - `hydrate()` — fetches `/me/permissions` (rxMethod; idempotent; cancels on re-invoke)
 *   - `reset()` — clears state on logout
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(INITIAL_STATE),

  withMethods((store) => {
    const http = inject(HttpClient);
    const log = inject(LoggerService);

    return {
      /**
       * Returns `true` when the cached permission set has expired (or was
       * never loaded). Implemented as a method (not a `computed`) because the
       * staleness test involves `Date.now()` which is not reactive — a
       * computed would latch the first value. Guards call this at navigation
       * time and always see a fresh read.
       */
      isStale(): boolean {
        return store.expiresAt() <= Date.now();
      },

      /**
       * Fetches `GET /api/v1/me/permissions`. Called by `AuthService` after
       * login and by the permission/role guards on demand (when data is stale).
       *
       * Idempotent: concurrent calls are collapsed by `switchMap` — the most
       * recent trigger wins, earlier in-flight responses are cancelled.
       *
       * Failure path: keeps any previously-loaded data but sets `error`.
       * Guards that encounter this state should fail closed (deny access)
       * and the UI should show a re-auth prompt.
       */
      hydrate: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            http.get<EffectivePermissions>(PERMISSIONS_ENDPOINT, { withCredentials: true }).pipe(
              tapResponse({
                next: (resp) => {
                  const ttl = (resp.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000;
                  patchState(store, {
                    roles: resp.roles,
                    permissions: resp.permissions,
                    bypass: resp.bypass,
                    expiresAt: Date.now() + ttl,
                    loading: false,
                    error: null,
                  });
                  log.info('auth.permissions.hydrated', {
                    roleCount: resp.roles.length,
                    permissionCount: resp.permissions.length,
                    bypass: resp.bypass,
                  });
                },
                error: (err: unknown) => {
                  const message = err instanceof Error ? err.message : 'Failed to load permissions.';
                  patchState(store, { loading: false, error: message });
                  log.error('auth.permissions.hydrate.failed', { error: err });
                },
              }),
            ),
          ),
        ),
      ),

      /**
       * Returns `true` iff the user has ANY of the supplied permissions
       * (OR semantics). Permissions are compared case-insensitively. The
       * server-granted `bypass` flag short-circuits to `true` — this is the
       * audit-friendly replacement for the legacy `'super:admin'` magic string.
       */
      hasAnyPermission(...perms: readonly string[]): boolean {
        if (store.bypass()) return true;
        const owned = new Set(store.permissions().map((p) => p.toLowerCase()));
        return perms.some((p) => owned.has(p.toLowerCase()));
      },

      /**
       * Returns `true` iff the user has ALL of the supplied permissions
       * (AND semantics). `bypass` short-circuits to `true`.
       */
      hasAllPermissions(...perms: readonly string[]): boolean {
        if (store.bypass()) return true;
        const owned = new Set(store.permissions().map((p) => p.toLowerCase()));
        return perms.every((p) => owned.has(p.toLowerCase()));
      },

      /** Role check (case-insensitive). `bypass` does NOT override role checks. */
      hasRole(role: string): boolean {
        return store.roles().some((r) => r.toLowerCase() === role.toLowerCase());
      },

      /** OR-semantics multi-role check. */
      hasAnyRole(...roles: readonly string[]): boolean {
        return roles.some((r) => this.hasRole(r));
      },

      /**
       * Clears all permission state. Called by `AuthService.logout` before the
       * MSAL redirect so in-flight UI doesn't flash stale data on the way out.
       */
      reset(): void {
        patchState(store, INITIAL_STATE);
      },
    };
  }),
);

/** Explicit type re-export for DI (`inject(AuthStore)` returns this). */
export type AuthStore = InstanceType<typeof AuthStore>;
