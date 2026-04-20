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

  /** MSAL placeholder — real values flow in via `/config.json` (Phase 2). */
  msal: {
    clientId: '',
    tenantId: '',
    redirectUri: 'http://localhost:4200',
    apiScope: '',
  },

  /** Network timeouts + retry policy. */
  http: {
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
  },
} as const;
