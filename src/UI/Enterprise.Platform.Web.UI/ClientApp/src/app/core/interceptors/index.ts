/**
 * Canonical interceptor chain, exported as an ordered tuple for convenience.
 *
 * Order (post-2026-04-25 single-tenant strip — `tenantInterceptor` removed):
 *   1. correlationInterceptor
 *   2. securityInterceptor — reads XSRF-TOKEN cookie → X-XSRF-TOKEN header
 *   3. cacheInterceptor    (Phase 6)
 *   4. dedupInterceptor    (Phase 6)
 *   5. loadingInterceptor
 *   6. loggingInterceptor
 *   7. retryInterceptor
 *   8. errorInterceptor
 */
export { correlationInterceptor } from './correlation.interceptor';
export { securityInterceptor } from './security.interceptor';
export { cacheInterceptor } from './cache.interceptor';
export { dedupInterceptor } from './dedup.interceptor';
export { loadingInterceptor } from './loading.interceptor';
export { loggingInterceptor } from './logging.interceptor';
export { retryInterceptor } from './retry.interceptor';
export { errorInterceptor } from './error.interceptor';
