/**
 * Barrel for `@core/models/*`. Consumers should import from here:
 *   `import type { PagedResponse, ApiError } from '@core/models';`
 * rather than deep paths.
 */
export type { BaseEntity } from './entity.model';
export type { PagedResponse, ApiResponse, ApiError } from './api-response.model';
export type {
  SortDirection,
  SortConfig,
  PaginationParams,
  SearchParams,
  QueryParams,
} from './query-params.model';
export { DEFAULT_QUERY_PARAMS } from './query-params.model';
export type { CurrentUser, EffectivePermissions } from './auth.model';
export type { RouteMetadata } from './route-metadata.model';
