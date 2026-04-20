/**
 * Production environment — build-time defaults.
 * @see environment.ts for field-level documentation.
 */
export const environment = {
  production: true,
  staging: false,
  buildStamp: '0000-00-00T00:00:00Z',

  apiBaseUrl: 'https://api.example.com/api/v1',
  bffBaseUrl: 'https://app.example.com',

  features: {
    showUiKit: false,
    enableLogging: false,
  },

  msal: {
    clientId: '',
    tenantId: '',
    redirectUri: 'https://app.example.com',
    apiScope: '',
  },

  http: {
    timeoutMs: 30000,
    retries: 3,
    retryDelayMs: 1000,
  },
} as const;
