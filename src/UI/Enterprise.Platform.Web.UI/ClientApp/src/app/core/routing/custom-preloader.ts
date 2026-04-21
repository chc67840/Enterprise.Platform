/**
 * ─── CustomPreloader ────────────────────────────────────────────────────────────
 *
 * Angular's default `PreloadAllModules` is too greedy — it downloads every
 * lazy chunk as soon as the app finishes bootstrapping, which defeats the
 * whole point of code splitting on slow / metered connections.
 *
 * `PreloadingStrategy` subclasses let the app decide per-route. Ours honours
 * two signals:
 *
 *   1. `data.preload === true`  — explicit opt-in on the route. Features
 *      that the user is likely to reach next (dashboard from login, user
 *      detail from user list) tag themselves; incidental ones don't.
 *
 *   2. `navigator.connection.saveData === false` — the Network Information
 *      API exposes whether the user has requested reduced data transfer
 *      (Android Chrome "Data Saver", iOS Low Data Mode). When `saveData` is
 *      true we skip preload entirely — the user told us to conserve.
 *
 * FALLBACK
 *   When `navigator.connection` isn't available (Firefox, Safari) we default
 *   to "preload eligible routes" — the conservative choice since no signal
 *   means no evidence of constraint.
 *
 * USAGE
 *   ```ts
 *   provideRouter(
 *     routes,
 *     withPreloading(CustomPreloader),
 *     // …
 *   )
 *
 *   // routes:
 *   {
 *     path: 'dashboard',
 *     data: { preload: true },
 *     loadComponent: () => import('./features/dashboard/dashboard.component')
 *       .then(m => m.DashboardComponent),
 *   }
 *   ```
 */
import { Injectable } from '@angular/core';
import { type PreloadingStrategy, type Route } from '@angular/router';
import { EMPTY, type Observable } from 'rxjs';

/** Narrowed view of the Network Information API. */
interface NetworkInformationLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/**
 * Route metadata slot used by the preloader. Feature routes spread
 * `{ preload: true }` into their `data` object to opt in.
 */
export interface PreloadableRouteData {
  readonly preload?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomPreloader implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const data = (route.data ?? {}) as PreloadableRouteData;
    if (data.preload !== true) {
      return EMPTY;
    }

    if (this.shouldSkipForSavedData()) {
      return EMPTY;
    }

    return load();
  }

  /**
   * Reads `navigator.connection.saveData`. Returns `true` only when the API
   * is available AND the user opted into Data Saver. Missing API → `false`
   * (proceed with preload — absence of signal is not evidence of constraint).
   */
  private shouldSkipForSavedData(): boolean {
    if (typeof navigator === 'undefined') return false;
    const connection = (
      navigator as Navigator & { connection?: NetworkInformationLike }
    ).connection;
    if (!connection) return false;
    return connection.saveData === true;
  }
}
