/**
 * ─── USER FEATURE — API SERVICE ─────────────────────────────────────────────────
 *
 * Hand-written HTTP service for the User aggregate. Does NOT extend
 * `BaseApiService<T>` because the backend deliberately models user mutations
 * as CQRS-style verb endpoints (`/users/{id}/name`, `/users/{id}/activate`,
 * etc.) rather than a single `PUT /users/{id}` full-replacement. Wrapping
 * those into the generic `update()` signature would lose the per-action
 * idempotency + audit story documented on the backend's command markers
 * (`IRequiresAudit`, `IIdempotent`, `ICacheRegionInvalidating`).
 *
 * Endpoint map (mirrors `Enterprise.Platform.Api/Endpoints/v1/Users/UserEndpoints.cs`):
 *
 *   GET    /users           — list (paging + search + active-only filter)
 *   GET    /users/{id}      — single
 *   POST   /users           — create
 *   PUT    /users/{id}/name — rename (firstName + lastName)
 *   PUT    /users/{id}/email — change email
 *   POST   /users/{id}/activate
 *   POST   /users/{id}/deactivate (body: { reason })
 *
 * All mutating verbs send an `Idempotency-Key` header so the backend's
 * `IdempotencyEndpointFilter` can collapse retries into a single applied
 * operation. We generate the key with `crypto.randomUUID()` per call — the
 * caller can override by passing a key in the options if a higher-layer
 * needs deterministic dedupe (e.g. user-supplied "submit" idempotency).
 *
 * Response validation: every successful response is run through the
 * matching Zod schema before it reaches the store / UI. Mismatches throw
 * `ZodError` which the global error interceptor surfaces as an `ApiError`
 * with the offending path.
 */
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL } from '@core/http/api-config.token';
import { generateIdempotencyKey } from '@utils';

import {
  type ChangeUserEmailRequest,
  type CreateUserRequest,
  type DeactivateUserRequest,
  type ListUsersParams,
  type ListUsersResponse,
  type RenameUserRequest,
  type UserDto,
} from './user.types';
import { listUsersResponseSchema, userDtoSchema } from './user.schemas';

/** Optional per-call overrides for mutating endpoints. */
export interface MutationOptions {
  /**
   * Override the auto-generated idempotency key. Useful when a higher layer
   * (form-level submit, retry button) wants the key to remain stable across
   * successive attempts so the server still recognises the duplicate.
   */
  readonly idempotencyKey?: string;
  /**
   * Set true to suppress the global error-toast interceptor. Use when the
   * caller needs to render the error inline (e.g. 409 Conflict on a duplicate
   * email goes onto the form's email field, not into a top-right toast).
   * Adds the `X-Skip-Error-Handling: true` header — the error interceptor
   * strips it and bypasses notification side-effects.
   */
  readonly suppressGlobalError?: boolean;
}

/** Optional per-call overrides for read endpoints (subset of MutationOptions). */
export interface ReadOptions {
  /** See `MutationOptions.suppressGlobalError`. */
  readonly suppressGlobalError?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `${baseUrl}/users` — every method is rooted here. */
  private get url(): string {
    return `${this.baseUrl}/users`;
  }

  // ── reads ───────────────────────────────────────────────────────────────

  /** GET /users — paged list. */
  list(params: ListUsersParams): Observable<ListUsersResponse> {
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.activeOnly !== null) {
      httpParams = httpParams.set('activeOnly', String(params.activeOnly));
    }

    return this.http
      .get<unknown>(this.url, { params: httpParams })
      .pipe(map((body) => listUsersResponseSchema.parse(body)));
  }

  /** GET /users/{id} — single user; observer errors on 404. */
  getById(id: string, options: ReadOptions = {}): Observable<UserDto> {
    return this.http
      .get<unknown>(`${this.url}/${encodeURIComponent(id)}`, {
        headers: this.suppressionHeader(options.suppressGlobalError),
      })
      .pipe(map((body) => userDtoSchema.parse(body)));
  }

  // ── writes ──────────────────────────────────────────────────────────────

  /** POST /users — create. Returns the freshly-created DTO (with server-assigned id). */
  create(request: CreateUserRequest, options: MutationOptions = {}): Observable<UserDto> {
    return this.http
      .post<unknown>(this.url, request, { headers: this.mutationHeaders(options) })
      .pipe(map((body) => userDtoSchema.parse(body)));
  }

  /** PUT /users/{id}/name — rename. 204 on success. */
  rename(id: string, request: RenameUserRequest, options: MutationOptions = {}): Observable<void> {
    return this.http.put<void>(
      `${this.url}/${encodeURIComponent(id)}/name`,
      request,
      { headers: this.mutationHeaders(options) },
    );
  }

  /** PUT /users/{id}/email — change canonical email. 204 on success. */
  changeEmail(id: string, request: ChangeUserEmailRequest, options: MutationOptions = {}): Observable<void> {
    return this.http.put<void>(
      `${this.url}/${encodeURIComponent(id)}/email`,
      request,
      { headers: this.mutationHeaders(options) },
    );
  }

  /** POST /users/{id}/activate — reactivate. 204 on success. */
  activate(id: string, options: MutationOptions = {}): Observable<void> {
    return this.http.post<void>(
      `${this.url}/${encodeURIComponent(id)}/activate`,
      null,
      { headers: this.mutationHeaders(options) },
    );
  }

  /** POST /users/{id}/deactivate — deactivate with reason. 204 on success. */
  deactivate(id: string, request: DeactivateUserRequest, options: MutationOptions = {}): Observable<void> {
    return this.http.post<void>(
      `${this.url}/${encodeURIComponent(id)}/deactivate`,
      request,
      { headers: this.mutationHeaders(options) },
    );
  }

  // ── internals ───────────────────────────────────────────────────────────

  /**
   * Builds the headers attached to every mutation:
   *   - `X-Idempotency-Key` — always emitted; the backend's
   *     `IdempotencyEndpointFilter` is mandatory on every mutation endpoint
   *     under `/api/v1/*` (attached via `.RequireIdempotencyKey()`). Header
   *     name MUST match `Enterprise.Platform.Shared.Constants.HttpHeaderNames.IdempotencyKey`
   *     (`X-Idempotency-Key`); a bare `Idempotency-Key` slips past as missing
   *     and the filter rejects with 400.
   *   - `X-Skip-Error-Handling` — only when `suppressGlobalError` is true; the
   *     error interceptor strips it and bypasses toast/redirect side-effects.
   */
  private mutationHeaders(options: MutationOptions): HttpHeaders {
    const key = options.idempotencyKey?.trim() || generateIdempotencyKey();
    let headers = new HttpHeaders({ 'X-Idempotency-Key': key });
    if (options.suppressGlobalError) {
      headers = headers.set('X-Skip-Error-Handling', 'true');
    }
    return headers;
  }

  /** Builds the headers for read endpoints (only suppression — no idempotency). */
  private suppressionHeader(suppress: boolean | undefined): HttpHeaders | undefined {
    return suppress ? new HttpHeaders({ 'X-Skip-Error-Handling': 'true' }) : undefined;
  }
}
