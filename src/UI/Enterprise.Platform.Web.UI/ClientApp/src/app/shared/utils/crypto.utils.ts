/**
 * ─── shared/utils/crypto ────────────────────────────────────────────────────────
 *
 * Thin, environment-tolerant wrappers around `crypto.randomUUID()`. Both
 * functions degrade gracefully in environments where `crypto.randomUUID`
 * isn't available (older jsdom in test runs, very old browsers) by
 * falling back to a Math.random-based UUID.
 *
 * Used by:
 *   - correlation interceptor (X-Correlation-ID per request)
 *   - users-api service (Idempotency-Key for POST/PUT/DELETE)
 *   - any future feature needing a stable per-event identifier
 */

/** RFC-4122 v4 UUID. Crypto-strong when available, Math.random fallback otherwise. */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: Math.random-based v4. Lower entropy than crypto.randomUUID
  // but still globally unique enough for non-cryptographic use cases
  // (correlation ids, idempotency keys for unauthenticated test runs).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Idempotency-Key for safe-to-retry mutations (POST / PUT / DELETE). The
 * BFF + downstream Api dedupe on this header so retries from a flaky
 * network don't duplicate the operation.
 */
export function generateIdempotencyKey(): string {
  return generateUuid();
}

/**
 * Correlation id for X-Correlation-ID. Same UUID space as idempotency
 * keys; named separately so call-sites read intentionally.
 */
export function generateCorrelationId(): string {
  return generateUuid();
}
