/** Barrel for reusable `signalStoreFeature`s composed by `createEntityStore`. */
export { withLoadingState } from './with-loading.feature';
export type { LoadingState } from './with-loading.feature';
export { withPagination } from './with-pagination.feature';
export type { PaginationState } from './with-pagination.feature';
export { withSearch } from './with-search.feature';
export type { SearchState } from './with-search.feature';
export { withSelection } from './with-selection.feature';
export type { SelectionState } from './with-selection.feature';
export { withEntityAdapter } from './with-entity-adapter.feature';
export { withPersistence } from './with-persistence.feature';
export type {
  PersistenceOptions,
  PersistenceStorage,
} from './with-persistence.feature';
export { withDevtools } from './with-devtools.feature';
