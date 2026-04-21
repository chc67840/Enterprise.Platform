/**
 * Canonical interceptor chain, exported as an ordered tuple for convenience.
 *
 * Order matches Architecture §4.3:
 *   1. MsalInterceptor (class-based; registered separately via HTTP_INTERCEPTORS)
 *   2. correlationInterceptor
 *   3. tenantInterceptor
 *   4. securityInterceptor
 *   5. (cacheInterceptor    — Phase 6)
 *   6. (dedupInterceptor    — Phase 6)
 *   7. loadingInterceptor
 *   8. loggingInterceptor
 *   9. retryInterceptor
 *  10. errorInterceptor
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
