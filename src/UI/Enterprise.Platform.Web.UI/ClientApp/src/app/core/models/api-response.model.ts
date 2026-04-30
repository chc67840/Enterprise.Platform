/**
 * ─── API RESPONSE CONTRACTS ─────────────────────────────────────────────────────
 *
 * WHY
 *   Pinning the shape of every server response at a single, central location:
 *
 *     1. Keeps the HTTP layer strongly typed end-to-end — `BaseApiService<T>`
 *        returns `Observable<ApiResponse<T>>` or `Observable<PagedResponse<T>>`,
 *        not `any`.
 *     2. Lets the `errorInterceptor` normalize any backend error (envelope or
 *        RFC-7807 ProblemDetails) into a single `ApiError` shape the stores +
 *        UI code can pattern-match on.
 *     3. Makes server-side validation errors (422) projectable onto form
 *        controls via `ServerErrorMapperService` (Phase 6).
 *
 * HOW IT'S USED
 *   - `BaseApiService<T>.getAll()` returns `Observable<PagedResponse<T>>`.
 *   - `BaseApiService<T>.getById/create/update/patch` return `Observable<ApiResponse<T>>`.
 *   - `errorInterceptor` catches raw `HttpErrorResponse` and constructs
 *     `ApiError` — downstream consumers should never read `HttpErrorResponse`
 *     directly.
 *
 * INTENTIONAL OMISSIONS
 *   - No `links` / HATEOAS field: we don't use it.
 *   - No `warnings` array: handled via notifications.
 *   - No generic `meta`: per-response metadata goes into the specific response
 *     type (e.g. `PagedResponse` has its own pagination meta).
 */

/**
 * A paginated list response.
 *
 * The backend `PagedResult<T>` DTO (see `Enterprise.Platform.Application`) emits
 * this shape for `GET /<endpoint>` with `page` / `pageSize` query params.
 *
 * `hasNext` / `hasPrev` are derived server-side so the UI never has to compute
 * them — cheaper than trusting the client with `total > page * pageSize` math
 * (off-by-one bugs are classic here).
 */
export interface PagedResponse<T> {
  /** The entities on the requested page, in server-ordered sequence. */
  readonly data: readonly T[];

  /** Total number of matching records across all pages. */
  readonly total: number;

  /** 1-based page index that was actually returned (may differ from request if out-of-range). */
  readonly page: number;

  /** Page size that was actually used (may differ from request if capped). */
  readonly pageSize: number;

  /** Convenience: ceil(total / pageSize). */
  readonly totalPages: number;

  /** True when `page < totalPages`. */
  readonly hasNext: boolean;

  /** True when `page > 1`. */
  readonly hasPrev: boolean;
}

/**
 * A single-resource response envelope.
 *
 * SUCCESS-FLAG SEMANTICS — see Docs/Architecture/master-config.models.ts §F9.
 *   • `success` here is a CARRIED FLAG, always `true` on a 2xx envelope —
 *     a sanity bit for older clients that don't inspect status codes.
 *   • The .NET `Result<T>.IsSuccess` is CONTROL FLOW on the server (railway-
 *     pattern). It is unwrapped inside the handler; only the `data` field
 *     of this envelope reaches the wire on success. Failures take a
 *     completely separate path (`ProblemDetailsExtended` 4xx / 5xx body).
 *   • New SPA code MUST branch on the Observable success/error channels (or
 *     `try/catch` for promises), NOT on this flag.
 */
export interface ApiResponse<T> {
  /** The single resource returned by the endpoint. */
  readonly data: T;

  /** Optional human-readable message (rarely used — most endpoints are silent). */
  readonly message?: string;

  /** Sanity flag; always `true` on a successful envelope. See doc-comment for full semantics. */
  readonly success: boolean;
}

/**
 * Normalized error shape emitted by the error interceptor.
 *
 * Source materials the interceptor can see on 4xx / 5xx:
 *   - RFC-7807 ProblemDetails (our backend's preferred shape on .NET 10)
 *   - Legacy `{ message, code }` envelopes
 *   - Raw `HttpErrorResponse` with no body (network errors)
 *   - Browser-level errors (CORS, timeouts)
 *
 * The interceptor flattens all of them into this uniform shape before stores /
 * components see them. Fields are all optional except `message` + `statusCode`
 * — those are guaranteed.
 */
export interface ApiError {
  /**
   * Human-readable description of what went wrong. Safe to display; never
   * exposes stack traces or internal identifiers in production (backend's
   * `ExceptionMappingMiddleware` strips these).
   */
  readonly message: string;

  /** HTTP status (400 / 401 / 403 / 404 / 409 / 422 / 500 / 0 for network). */
  readonly statusCode: number;

  /**
   * Stable machine-readable code from `ErrorCodes` (e.g. `EP.Validation`,
   * `EP.Conflict`). Safe to switch on in UI logic; never localize.
   */
  readonly code?: string;

  /**
   * Per-field validation errors (422 responses only). Keyed by field path
   * using the backend's serialization convention — typically camelCase, dots
   * for nested fields (`address.postalCode`).
   */
  readonly errors?: Readonly<Record<string, readonly string[]>>;

  /**
   * Correlation id returned by the backend via `X-Correlation-ID`. Logged by
   * both sides; included in support queries and telemetry spans.
   */
  readonly correlationId?: string;

  /** Server-emitted timestamp of the failure (ISO-8601 UTC). */
  readonly timestamp?: string;
}
