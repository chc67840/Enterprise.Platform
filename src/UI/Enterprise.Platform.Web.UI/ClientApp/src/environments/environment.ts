/**
 * Development environment — build-time defaults.
 *
 * Runtime values that change per-deployment (apiBaseUrl, telemetry DSN) land
 * in `public/config.json` via `loadRuntimeConfig`. Anything in this file is
 * either truly static (build-time flags, feature gates that never change) or
 * a sensible fallback for genuinely-offline dev.
 *
 * Post-Phase-9 note: Entra client/tenant IDs are NOT here — they moved to
 * the BFF's `appsettings.*.json`. The SPA is cookie-session authenticated
 * and never talks to Entra directly.
 *
 * NEVER place secrets here. Anything with entropy belongs in deployment
 * configuration.
 */
export const environment = {
  production: false,
  staging: false,
  buildStamp: '0000-00-00T00:00:00Z',

  /** Runtime-config fallbacks used when `/config.json` is unreachable in dev. */
  apiBaseUrl: '/api/proxy/v1',
  bffBaseUrl: '',

  /** Build-time feature flags — runtime flags live in `/config.json`. */
  features: {
    showUiKit: true,
    enableLogging: true,
  },

  /** Network timeouts + retry policy. */
  http: {
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
  },
} as const;
