/**
 * ─── ERROR INTERCEPTOR ──────────────────────────────────────────────────────────
 *
 * WHY
 *   **Single-source error UX.** Every HTTP failure in the app flows through
 *   exactly one place: this interceptor. It:
 *
 *     1. Normalizes the raw `HttpErrorResponse` into a uniform `ApiError`
 *        shape that the rest of the app pattern-matches on.
 *     2. Shows the right user-facing toast for the status code (400-class
 *        vs 5xx vs auth).
 *     3. Triggers navigation for terminal states — 403 → `/error/forbidden`,
 *        unrecoverable 401 → `/auth/login`, etc.
 *     4. Re-throws the normalized error so downstream subscribers (stores)
 *        can capture it into their local `error()` signal for inline display.
 *
 *   The policy is: **interceptors own toasts; stores own inline error display.**
 *   Stores must NEVER call `notify.error(...)` on an HTTP failure — this
 *   avoids the classic "two toasts for one failure" bug.
 *
 * STATUS-CODE POLICY
 *   401 (Unauthenticated):
 *     The BFF's `OnValidatePrincipal` hook rotates the access token silently;
 *     a 401 reaching us means the refresh token itself was rejected (session
 *     invalidated). Show a sticky "session expired" toast and redirect to
 *     `/api/auth/login` for a fresh OIDC flow.
 *
 *   403 (Forbidden):
 *     Server refused. Show toast + navigate to `/error/forbidden`.
 *
 *   404 (Not Found):
 *     No toast by default — the screen typically renders an empty state.
 *     Stores can elect to show one via their own logic if desired.
 *
 *   409 (Conflict — optimistic concurrency):
 *     Show an actionable toast ("Record changed — refresh?"). Stores detect
 *     the same code and roll back optimistic mutations.
 *
 *   422 (Validation):
 *     No toast. Backend emits per-field `errors` which forms project inline
 *     (via the future `ServerErrorMapperService`). A global toast would be
 *     redundant with the field-level feedback.
 *
 *   5xx (Server error):
 *     Toast + optional telemetry. For 503 specifically, `retryInterceptor`
 *     will have already retried — if we're here, it's exhausted.
 *
 *   0 (network):
 *     "Unable to reach the server" — network-offline UX. Phase 10 may add
 *     a `/error/offline` route.
 *
 * OPT-OUT
 *   Callers that want to handle errors entirely themselves (silent polls,
 *   advanced error boundaries) set `X-Skip-Error-Handling: true`. The
 *   interceptor strips the header and passes the raw error through.
 */
import {
  type HttpErrorResponse,
  type HttpInterceptorFn,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import type { ApiError } from '@core/models';
import { NotificationService } from '@core/services/notification.service';

const SKIP_HEADER = 'X-Skip-Error-Handling';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(SKIP_HEADER)) {
    const cleanReq = req.clone({ headers: req.headers.delete(SKIP_HEADER) });
    return next(cleanReq);
  }

  const notify = inject(NotificationService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      const normalized = normalize(err);
      handleSideEffects(normalized, notify, router);
      return throwError(() => normalized);
    }),
  );
};

// ── normalize ──────────────────────────────────────────────────────────────

/**
 * Coerces any error shape the backend might emit into our `ApiError`.
 * Handles RFC-7807 ProblemDetails, legacy `{ message, code }` envelopes, and
 * browser-level network failures.
 */
function normalize(err: unknown): ApiError {
  const httpErr = err as HttpErrorResponse;

  // Network / CORS / timeout — HttpErrorResponse with status 0
  if (httpErr.status === 0) {
    return {
      message: 'Unable to reach the server. Please check your connection.',
      statusCode: 0,
      code: 'EP.Network',
    };
  }

  // Body may be a ProblemDetails, a typed `ApiError`, or arbitrary text.
  const body = (httpErr.error ?? {}) as Record<string, unknown>;
  const message =
    (body['message'] as string | undefined) ??
    (body['title'] as string | undefined) ??
    (body['detail'] as string | undefined) ??
    httpErr.message ??
    'An unexpected error occurred.';

  return {
    message,
    statusCode: httpErr.status,
    code: (body['code'] as string | undefined) ?? (body['type'] as string | undefined),
    errors: body['errors'] as Record<string, string[]> | undefined,
    correlationId: httpErr.headers?.get?.('X-Correlation-ID') ?? undefined,
    timestamp: (body['timestamp'] as string | undefined) ?? new Date().toISOString(),
  };
}

// ── side-effects (toasts + navigation) ────────────────────────────────────

function handleSideEffects(err: ApiError, notify: NotificationService, router: Router): void {
  switch (err.statusCode) {
    case 0:
      notify.error('You appear to be offline', err.message);
      return;

    case HttpStatusCode.Unauthorized:
      // BFF owns token rotation via OnValidatePrincipal. A 401 reaching us
      // means the session itself is dead — navigate to the local login page
      // where the user triggers a fresh OIDC flow via AuthService.login().
      notify.sticky('warn', 'Session expired', 'Please sign in again to continue.');
      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: router.url },
      });
      return;

    case HttpStatusCode.Forbidden:
      notify.error('Access denied', err.message);
      router.navigate(['/error/forbidden']);
      return;

    case HttpStatusCode.NotFound:
      // No toast — let the feature render its own empty state.
      return;

    case HttpStatusCode.Conflict:
      notify.warn(
        'Record changed',
        'Another user updated this record. Refresh to see the latest version.',
      );
      return;

    case HttpStatusCode.UnprocessableEntity:
      // No toast — forms project per-field errors via ServerErrorMapperService (Phase 6).
      return;

    case HttpStatusCode.InternalServerError:
    case HttpStatusCode.BadGateway:
    case HttpStatusCode.ServiceUnavailable:
    case HttpStatusCode.GatewayTimeout:
      notify.error('Server error', err.message);
      return;

    default:
      // 4xx not otherwise handled — show the server's message if present.
      if (err.statusCode >= 400 && err.statusCode < 500) {
        notify.warn(`Request failed (${err.statusCode})`, err.message);
      }
  }
}
