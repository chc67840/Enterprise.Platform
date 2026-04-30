/**
 * ─── HTTP HEADER NAME CONSTANTS ─────────────────────────────────────────────────
 *
 * SPA-side mirror of `Enterprise.Platform.Shared.Constants.HttpHeaderNames`
 * plus SPA-only header names (XSRF, error-skip hint). Closes FLAGS §F6 from
 * `Docs/Architecture/master-config.models.ts` — drift between tiers caused a
 * March 2026 incident when a header rename only updated one side.
 *
 * USE THESE CONSTANTS rather than string literals when reading or writing
 * HTTP headers anywhere in the SPA. Renames then become a single-file edit
 * caught at TS-check time, not a runtime header-mismatch surprise.
 *
 * ▲ DRIFT GUARD (informal)
 *   When a wire header is renamed on the server, also update this file in
 *   the same PR. The Architecture.Tests project does not yet diff this file
 *   against `HttpHeaderNames.cs`; until it does, treat this as a hand-mirror.
 */

// ─── Wire headers — must mirror Enterprise.Platform.Shared.Constants.HttpHeaderNames ──

/** End-to-end correlation id for a single request across services. */
export const X_CORRELATION_ID = 'X-Correlation-ID';

/**
 * Caller-supplied idempotency key for at-most-once command execution.
 *
 * IMPORTANT — the `X-` prefix is REQUIRED. The backend's
 * `IdempotencyEndpointFilter` looks ONLY for `X-Idempotency-Key`; a bare
 * `Idempotency-Key` slips past as missing and the filter 400s.
 * (See memory `feedback_idempotency_header_name`.)
 */
export const X_IDEMPOTENCY_KEY = 'X-Idempotency-Key';

/** Requested API version. Consumed by `Asp.Versioning` on the server. */
export const X_API_VERSION = 'X-API-Version';

/** Client-specified request id (propagated alongside `X-Correlation-ID` in logs). */
export const X_REQUEST_ID = 'X-Request-ID';

// ─── SPA-only headers — server has no constant for these ──────────────────────

/**
 * Request-scoped opt-out hint read by `errorInterceptor`. When set, the
 * interceptor:
 *   1. Strips this header before sending (it is NOT a wire header — purely a
 *      pipeline directive).
 *   2. Suppresses toast + redirect side-effects on failure.
 *   3. Still normalises the error so callers receive `ApiError`.
 *
 * Use sparingly — silent polls and feature-owned error UX (forms with inline
 * field errors) are the common cases.
 */
export const X_SKIP_ERROR_HANDLING = 'X-Skip-Error-Handling';

/**
 * Anti-forgery token echo header. The BFF sets the `XSRF-TOKEN` cookie; the
 * `securityInterceptor` reads the cookie value and echoes it back here on
 * every same-origin `/api/*` call. The BFF's antiforgery middleware verifies
 * they match (double-submit defense).
 */
export const X_XSRF_TOKEN = 'X-XSRF-TOKEN';

/** Distinguishes XHR / fetch from full-page navigations on the server. */
export const X_REQUESTED_WITH = 'X-Requested-With';

/** Asks server / browser not to MIME-sniff responses (defense-in-depth). */
export const X_CONTENT_TYPE_OPTIONS = 'X-Content-Type-Options';

// ─── Cookie names ─────────────────────────────────────────────────────────────

/** Cookie name carrying the anti-forgery token (read by `securityInterceptor`). */
export const XSRF_TOKEN_COOKIE = 'XSRF-TOKEN';
