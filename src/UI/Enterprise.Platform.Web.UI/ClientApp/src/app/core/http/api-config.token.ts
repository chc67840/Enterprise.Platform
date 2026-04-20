/**
 * ─── API_BASE_URL TOKEN ─────────────────────────────────────────────────────────
 *
 * WHY AN INJECTION TOKEN (not importing `environment.apiBaseUrl` directly)
 *   Tokenising this value gives us two advantages:
 *
 *     1. **Swappability** — tests can override the URL via a single DI provider:
 *          `providers: [{ provide: API_BASE_URL, useValue: 'http://mock' }]`
 *        No `environment.ts` shimming, no `jest.mock(...)`.
 *
 *     2. **Runtime override** — once the Phase 2.1 runtime-config loader lands,
 *        the token's factory can pull from `RUNTIME_CONFIG.apiBaseUrl` instead
 *        of the build-time environment. Flipping API endpoints at deploy-time
 *        without a rebuild.
 *
 * HOW IT'S USED
 *   ```ts
 *   protected readonly baseUrl = inject(API_BASE_URL);
 *   ```
 *
 *   The default factory below returns the build-time `environment.apiBaseUrl`
 *   — `app.config.ts` overrides with `{ provide: API_BASE_URL, useValue: ... }`
 *   in later phases to source from runtime config.
 */
import { InjectionToken } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Injection token for the API base URL. Example:
 *   `'https://api.example.com/api/v1'`
 *
 * Always includes the version segment (`/v1`). Endpoints are joined with `/`:
 *   `${baseUrl}/users` → `https://api.example.com/api/v1/users`
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
