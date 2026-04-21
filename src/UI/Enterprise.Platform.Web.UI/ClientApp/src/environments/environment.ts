/**
 * Development environment — build-time defaults.
 *
 * Runtime values that change per-deployment (apiBaseUrl, msal IDs, telemetry DSN)
 * land in `public/config.json` starting Phase 2.1. Anything in this file should
 * be either truly static (build-time flags, feature gates that never change) or
 * a sensible fallback for offline dev.
 *
 * NEVER place secrets here. MSAL `clientId` is a public identifier; anything
 * with entropy belongs in deployment configuration.
 */
export const environment = {
  production: false,
  staging: false,
  buildStamp: '0000-00-00T00:00:00Z',

  /** Runtime-config fallbacks used when `/config.json` is unreachable in dev. */
  apiBaseUrl: 'http://localhost:5044/api/v1',
  bffBaseUrl: 'http://localhost:5001',

  /** Build-time feature flags — runtime flags live in `/config.json`. */
  features: {
    showUiKit: true,
    enableLogging: true,
  },

  /**
   * MSAL offline-dev fallback. Matches `public/config.json` so dev sessions
   * that can't reach `/config.json` still boot against the real Entra
   * tenant. `/config.json` wins when present.
   *
   * NOTE: `apiScope` follows the single-app-registration pattern
   * (`api://{SPA-clientId}/access_as_user`). If a separate Api app
   * registration is introduced, swap to `api://{Api-clientId}/access_as_user`
   * in both places.
   */
  msal: {
    clientId: 'a703a89e-19ba-4ffb-bdfc-aa65b72833f4',
    tenantId: 'f404bba4-4ff2-4d0b-a967-484b87662ab0',
    redirectUri: 'http://localhost:4200',
    apiScope: 'api://a703a89e-19ba-4ffb-bdfc-aa65b72833f4/access_as_user',
  },

  /** Network timeouts + retry policy. */
  http: {
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
  },
} as const;
