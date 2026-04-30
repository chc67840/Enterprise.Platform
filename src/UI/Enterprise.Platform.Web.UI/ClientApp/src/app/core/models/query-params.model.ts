/**
 * ─── LIST-QUERY PARAMETERS ──────────────────────────────────────────────────────
 *
 * WHY
 *   Every entity list endpoint takes the same four knobs — pagination, search,
 *   sort, and filters. Pinning them in a single `QueryParams` type keeps:
 *
 *     - `BaseApiService.getAll(params)` consistent across every feature;
 *     - `createEntityStore` feature-composable (see `withSearch`, `withPagination`);
 *     - query-string serialization centralized in `BaseApiService.buildParams`.
 *
 * HOW IT'S USED
 *   A feature store hydrates `QueryParams` into its state (via `withSearch` +
 *   `withPagination`), mutates via `setPage / setSearchQuery / setSortConfig /
 *   setFilter`, and passes the result into `api.getAll(...)`.
 *
 *   `BaseApiService.buildParams` encodes the object into `HttpParams` using the
 *   convention:
 *     - `page=<1-based>&pageSize=<N>`
 *     - `q=<text>`
 *     - `sortBy=<field>&sortDir=<asc|desc>`
 *     - `<filterKey>=<value>` for each non-null filter
 *
 * DESIGN NOTES
 *   - `page` is 1-based to match the backend's `PagedResult<T>` convention.
 *   - `filters` is `Record<string, unknown>` intentionally — feature teams set
 *     their own keys (`?status=active`, `?createdAfter=2026-01-01`); typing
 *     them more tightly would force a change here for every new filter.
 */

/**
 * Wire-format sort direction — values match what the backend expects in the
 * `sortDir` query parameter.
 *
 * NOT THE SAME AS `@shared/components/dph#SortDirection` — see
 * Docs/Architecture/master-config.models.ts §F2:
 *   • THIS type (two-state)  : used in `QueryParams.sort`, sent on the wire.
 *   • DPH type   (tri-state) : adds `null` for "no sort applied" — local to
 *                              the data-table column-click cycle and must
 *                              never reach the wire.
 *
 * Wire convention is camelCase ('asc' / 'desc'). The .NET `SortDirection`
 * enum serialises as PascalCase ('Asc' / 'Desc') by default — the BFF maps
 * between the two on request ingest.
 */
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  /** Entity field to sort on (dot-path for nested props — e.g. `address.city`). */
  readonly field: string;

  /** Ascending / descending. */
  readonly direction: SortDirection;
}

export interface PaginationParams {
  /** 1-based page index. Defaults to 1 for first page. */
  readonly page: number;

  /** Number of rows per page. Server caps this — typical max 100. */
  readonly pageSize: number;
}

export interface SearchParams {
  /** Free-text search string. Empty / undefined = no search filter applied. */
  readonly query?: string;
}

/**
 * Full query-parameter envelope for list endpoints.
 *
 * Any field may be omitted; the base service skips missing ones during URL
 * encoding so short query strings stay short.
 */
export interface QueryParams extends PaginationParams, SearchParams {
  /** Single-column sort. Multi-sort support isn't on the roadmap today. */
  readonly sort?: SortConfig;

  /**
   * Arbitrary per-feature filters. Keys become query-string parameters
   * verbatim; values are stringified with `String(v)` — for complex values
   * (e.g. date ranges) call sites should pre-stringify to ISO form.
   */
  readonly filters?: Readonly<Record<string, unknown>>;
}

/**
 * Baseline used by stores when they initialise. Each feature store may override
 * the page size in its `createEntityStore({ defaultPageSize })` config.
 */
export const DEFAULT_QUERY_PARAMS: QueryParams = {
  page: 1,
  pageSize: 20,
  query: '',
  filters: {},
};
