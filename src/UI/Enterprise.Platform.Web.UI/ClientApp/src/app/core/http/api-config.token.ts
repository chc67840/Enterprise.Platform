/**
 * ─── API_BASE_URL TOKEN ─────────────────────────────────────────────────────────
 *
 * WHY AN INJECTION TOKEN (not importing `environment.apiBaseUrl` directly)
 *   Tokenising this value gives us two advantages:
 *
 *     1. **Swappability** — tests can override the URL via a single DI provider:
 *          `providers: [{ provide: API_BASE_URL, useValue: 'http://mock' }]`
 *        No `environment.ts` shimming, no `vi.mock(...)`.
 *
 *     2. **Runtime override** — the factory pulls from `RUNTIME_CONFIG`
 *        (Phase 2.1) so the deployment can point at any backend without a
 *        rebuild. `environment.apiBaseUrl` remains as the offline-dev fallback
 *        and is consumed by the runtime-config loader's `buildFallbackConfig`.
 *
 * HOW IT'S USED
 *   ```ts
 *   protected readonly baseUrl = inject(API_BASE_URL);
 *   ```
 *
 * WHY A TOKEN OVER A DIRECT `inject(RUNTIME_CONFIG)` CALL
 *   Callers that only need the base URL don't have to know about the broader
 *   runtime-config shape. Keeps the dependency surface minimal and means the
 *   token stays stable even if the runtime-config structure evolves.
 */
import { InjectionToken, inject } from '@angular/core';

import { RUNTIME_CONFIG } from '@config/runtime-config';

/**
 * Injection token for the API base URL. Example:
 *   `'https://api.example.com/api/v1'`
 *
 * Always includes the version segment (`/v1`). Endpoints are joined with `/`:
 *   `${baseUrl}/users` → `https://api.example.com/api/v1/users`
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => inject(RUNTIME_CONFIG).apiBaseUrl,
});
