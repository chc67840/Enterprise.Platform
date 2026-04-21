/**
 * Canonical interceptor chain, exported as an ordered tuple for convenience.
 *
 * Order matches Architecture §4.3 (updated for Phase 9 — MSAL removed;
 * bearer-token attachment now happens server-side in the BFF proxy):
 *   1. correlationInterceptor
 *   2. tenantInterceptor
 *   3. securityInterceptor — reads XSRF-TOKEN cookie → X-XSRF-TOKEN header
 *   4. cacheInterceptor    (Phase 6)
 *   5. dedupInterceptor    (Phase 6)
 *   6. loadingInterceptor
 *   7. loggingInterceptor
 *   8. retryInterceptor
 *   9. errorInterceptor
 */
export { correlationInterceptor } from './correlation.interceptor';
export { tenantInterceptor } from './tenant.interceptor';
export { securityInterceptor } from './security.interceptor';
export { cacheInterceptor } from './cache.interceptor';
export { dedupInterceptor } from './dedup.interceptor';
export { loadingInterceptor } from './loading.interceptor';
export { loggingInterceptor } from './logging.interceptor';
export { retryInterceptor } from './retry.interceptor';
export { errorInterceptor } from './error.interceptor';
