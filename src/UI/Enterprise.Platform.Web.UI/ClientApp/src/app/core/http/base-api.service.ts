/**
 * ─── BASE API SERVICE ───────────────────────────────────────────────────────────
 *
 * WHY
 *   Every entity the SPA talks to has the same CRUD surface on the backend
 *   (`GET /` for list, `GET /:id` for detail, `POST /` for create, `PUT /:id`
 *   and `PATCH /:id` for update, `DELETE /:id` for delete, `POST /bulk-delete`
 *   for batch). Rather than re-code that plumbing per feature, we declare it
 *   once in a generic abstract class. A feature service becomes three lines:
 *
 *     ```ts
 *     @Injectable({ providedIn: 'root' })
 *     export class UsersApiService extends BaseApiService<User> {
 *       protected override readonly endpoint = 'users';
 *     }
 *     ```
 *
 *   Custom endpoints (`activate`, `resetPassword`, ...) get added as extra
 *   methods on the subclass.
 *
 * WHAT THIS CLASS OWNS
 *   - Full URL building from `API_BASE_URL + endpoint + id`.
 *   - `QueryParams` → `HttpParams` serialization via `buildParams(...)`.
 *   - `If-Match` header attachment on `update`/`patch` for optimistic
 *     concurrency.
 *   - Response typing — every return is `Observable<PagedResponse<T>>` /
 *     `Observable<ApiResponse<T>>` / `Observable<void>`.
 *
 * WHAT THIS CLASS DOES **NOT** OWN
 *   - Auth headers — `MsalInterceptor` attaches the bearer token.
 *   - Tenant headers — `tenantInterceptor` attaches `X-Tenant-ID`.
 *   - Retry / error normalization / loading indication — separate interceptors.
 *
 *   Those concerns live in the interceptor chain (see Architecture §4.3).
 *   This file only emits HTTP requests; everything cross-cutting runs around
 *   it.
 *
 * OPTIMISTIC CONCURRENCY
 *   `update()` and `patch()` emit `If-Match: "<version>"` when the entity
 *   carries a `version` field. The backend's `RowVersion` check compares
 *   this against the database; a mismatch returns 409 Conflict. The
 *   `errorInterceptor` recognizes 409 and renders a "record changed, please
 *   refresh" toast with a retry CTA. Stores using optimistic updates roll
 *   back their state on 409.
 */
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from './api-config.token';
import type { ApiResponse, BaseEntity, PagedResponse, QueryParams } from '@core/models';

@Injectable()
export abstract class BaseApiService<T extends BaseEntity> {
  protected readonly http = inject(HttpClient);
  protected readonly baseUrl = inject(API_BASE_URL);

  /**
   * REST endpoint for this entity, relative to `baseUrl`. Subclasses set
   * this via `protected override readonly endpoint = 'users';`. Abstract
   * so the compiler forces every subclass to declare one.
   */
  protected abstract readonly endpoint: string;

  /** Full URL for the endpoint. `baseUrl` ends without a trailing slash. */
  protected get url(): string {
    return `${this.baseUrl}/${this.endpoint}`;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * GET paginated list. Forwards `QueryParams` as URL query string.
   *
   * @example
   *   api.getAll({ page: 2, pageSize: 50, query: 'alice', sort: { field: 'createdAt', direction: 'desc' } })
   */
  getAll(params?: Partial<QueryParams>): Observable<PagedResponse<T>> {
    const httpParams = this.buildParams(params);
    return this.http.get<PagedResponse<T>>(this.url, { params: httpParams });
  }

  /** GET single entity by id. */
  getById(id: string): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.url}/${encodeURIComponent(id)}`);
  }

  /**
   * POST create. `Partial<T>` because the client never sends server-assigned
   * fields (`id`, audit columns, `version`). The server fills those in.
   */
  create(entity: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(this.url, entity);
  }

  /**
   * PUT full replacement.
   *
   * If `entity.version` is set, emit `If-Match` so the backend enforces
   * optimistic concurrency. Stores using optimistic updates must pass the
   * currently-known version for this to work end-to-end.
   */
  update(id: string, entity: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.url}/${encodeURIComponent(id)}`, entity, {
      headers: this.buildIfMatch(entity.version),
    });
  }

  /** PATCH partial update. Same `If-Match` semantics as `update`. */
  patch(id: string, entity: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.url}/${encodeURIComponent(id)}`, entity, {
      headers: this.buildIfMatch(entity.version),
    });
  }

  /** DELETE single entity. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  /**
   * Batch delete.
   *
   * WHY POST (not DELETE with body): HTTP `DELETE` with request body is not
   * universally supported by proxies / gateways — some strip the body.
   * `POST /<endpoint>/bulk-delete` is reliable everywhere.
   */
  bulkDelete(ids: readonly string[]): Observable<void> {
    return this.http.post<void>(`${this.url}/bulk-delete`, { ids });
  }

  // ── INTERNALS ────────────────────────────────────────────────────────────

  /**
   * Serializes `QueryParams` into `HttpParams`.
   *
   * Conventions:
   *   - `page`, `pageSize` always emitted when set (numeric).
   *   - `q` for the search query (shorter than `query`, matches backend DTO).
   *   - `sortBy` + `sortDir` for sort — skipped when no sort is requested.
   *   - Each filter key → its own query param; `undefined` / `null` / `''`
   *     are dropped so clean URLs stay clean.
   */
  protected buildParams(params?: Partial<QueryParams>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    if (params.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.pageSize != null) {
      httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    if (params.query) {
      httpParams = httpParams.set('q', params.query);
    }
    if (params.sort) {
      httpParams = httpParams.set('sortBy', params.sort.field).set('sortDir', params.sort.direction);
    }
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        if (value === undefined || value === null || value === '') continue;
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  /**
   * Builds an `If-Match` header when the entity has a version token.
   *
   * The backend's ETag convention is a quoted string (`"<base64>"`); we
   * delegate the quoting to Angular's `HttpHeaders` which handles the
   * transport. If no version is present, we return an empty `HttpHeaders`
   * so the request shape is unchanged — old entities that pre-date the
   * concurrency column continue to work.
   */
  protected buildIfMatch(version: string | undefined): HttpHeaders {
    if (!version) return new HttpHeaders();
    // Quote per RFC 7232 (If-Match takes an ETag which is a quoted string).
    return new HttpHeaders({ 'If-Match': `"${version}"` });
  }
}
