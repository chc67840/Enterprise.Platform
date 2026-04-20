/**
 * Staging environment — build-time defaults.
 * @see environment.ts for field-level documentation.
 */
export const environment = {
  production: false,
  staging: true,
  buildStamp: '0000-00-00T00:00:00Z',

  apiBaseUrl: 'https://staging-api.example.com/api/v1',
  bffBaseUrl: 'https://staging.example.com',

  features: {
    showUiKit: false,
    enableLogging: true,
  },

  msal: {
    clientId: '',
    tenantId: '',
    redirectUri: 'https://staging.example.com',
    apiScope: '',
  },

  http: {
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
  },
} as const;
