/**
 * ─── DPH UI KIT — DATA TABLE — DATA SOURCES ─────────────────────────────────────
 *
 * The DataTable accepts EITHER:
 *   (a) `data` input  — host owns rows; component just renders + paginates client-side.
 *   (b) `dataSource`  — server-mode; component drives queries, handles cancellation
 *       + race-conditions, surfaces loading / error states centrally.
 *
 * Use `LocalDataSource` to demo / test (b) with in-memory data. Use
 * `RemoteDataSource` to wrap a fetch fn that returns Observable<TablePage<T>>.
 *
 * `DataTableSource` is a structural alias of the public `DataSource<T>` type
 * declared in `dph.types.ts` — typed properly here (the public type uses
 * `unknown` to avoid leaking RxJS into the type vocabulary).
 */
import { defer, of, type Observable } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import type {
  ColumnFilter,
  DataSource,
  FilterValue,
  SortState,
  TablePage,
  TableQuery,
} from '../dph.types';

/** Strongly-typed alias used internally — same shape as `DataSource<T>`. */
export interface DataTableSource<T> extends DataSource<T> {
  load(query: TableQuery): Observable<TablePage<T>>;
}

/** In-memory source — applies sort/filter/page client-side. Useful for demos + tests. */
export class LocalDataSource<T extends Record<string, unknown>> implements DataTableSource<T> {
  /** Optional artificial latency in ms (demos only — never set in prod). */
  constructor(
    private readonly rows: readonly T[],
    private readonly latencyMs = 0,
  ) {}

  load(query: TableQuery): Observable<TablePage<T>> {
    return defer(() => of(this.rows)).pipe(
      delay(this.latencyMs),
      map((all) => {
        const filtered = applyFiltersAndGlobal(all, query);
        const sorted = applySort(filtered, query.sort);
        const total = sorted.length;
        const start = (query.page - 1) * query.pageSize;
        const end = start + query.pageSize;
        return { rows: sorted.slice(start, end), total } satisfies TablePage<T>;
      }),
    );
  }
}

/** Wrap any fn returning Observable<TablePage<T>> as a DataSource. */
export class RemoteDataSource<T> implements DataTableSource<T> {
  constructor(private readonly fetcher: (q: TableQuery) => Observable<TablePage<T>>) {}
  load(query: TableQuery): Observable<TablePage<T>> {
    return this.fetcher(query);
  }
}

// ─── In-memory helpers (exported for tests + the LocalDataSource) ────────────

export function applyFiltersAndGlobal<T extends Record<string, unknown>>(
  rows: readonly T[],
  query: TableQuery,
): readonly T[] {
  let out = rows;
  if (query.filters.length) {
    out = out.filter((row) => query.filters.every((f) => matchFilter(row, f)));
  }
  if (query.globalFilter && query.globalFilter.trim()) {
    const needle = query.globalFilter.trim().toLowerCase();
    out = out.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(needle)),
    );
  }
  return out;
}

export function matchFilter<T extends Record<string, unknown>>(row: T, f: ColumnFilter): boolean {
  if (f.value == null) return true;
  const raw = readNested(row, f.field);
  return matchOp(raw, f.value);
}

function matchOp(raw: unknown, fv: FilterValue): boolean {
  const { op, value, value2 } = fv;
  const s = (x: unknown) => (x == null ? '' : String(x).toLowerCase());
  const n = (x: unknown) => (typeof x === 'number' ? x : Number(x));
  const d = (x: unknown) => {
    if (x instanceof Date) return x.getTime();
    if (typeof x === 'string' || typeof x === 'number') return new Date(x).getTime();
    return Number.NaN;
  };
  switch (op) {
    case 'contains':
      return s(raw).includes(s(value));
    case 'notContains':
      return !s(raw).includes(s(value));
    case 'equals':
      return s(raw) === s(value);
    case 'notEquals':
      return s(raw) !== s(value);
    case 'startsWith':
      return s(raw).startsWith(s(value));
    case 'endsWith':
      return s(raw).endsWith(s(value));
    case 'lt':
      return n(raw) < n(value);
    case 'lte':
      return n(raw) <= n(value);
    case 'gt':
      return n(raw) > n(value);
    case 'gte':
      return n(raw) >= n(value);
    case 'between':
      return n(raw) >= n(value) && n(raw) <= n(value2);
    case 'before':
      return d(raw) < d(value);
    case 'after':
      return d(raw) > d(value);
    case 'on':
      return sameDay(d(raw), d(value));
    case 'dateRange':
      return d(raw) >= d(value) && d(raw) <= d(value2);
    case 'inLast': {
      const days = n(value);
      const cutoff = Date.now() - days * 86_400_000;
      return d(raw) >= cutoff;
    }
    case 'is':
      return raw === value;
    case 'isNot':
      return raw !== value;
    case 'in':
      return Array.isArray(value) && value.some((v) => s(raw) === s(v));
    case 'notIn':
      return Array.isArray(value) && !value.some((v) => s(raw) === s(v));
    case 'isEmpty':
      return raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    case 'isNotEmpty':
      return !(raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0));
    default:
      return true;
  }
}

function sameDay(a: number, b: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function applySort<T extends Record<string, unknown>>(
  rows: readonly T[],
  sort: readonly SortState[],
): readonly T[] {
  if (!sort.length) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const s of sort) {
      if (!s.field || s.direction == null) continue;
      const av = readNested(a, s.field);
      const bv = readNested(b, s.field);
      const cmp = compareUnknown(av, bv);
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
  return sorted;
}

function compareUnknown(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function readNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/** Aggregator helpers — sum/avg/count/min/max for footer totals row. */
export function aggregate(
  rows: readonly Record<string, unknown>[],
  field: string,
  kind: 'sum' | 'avg' | 'count' | 'min' | 'max',
): number {
  if (!rows.length) return 0;
  const values = rows
    .map((r) => readNested(r, field))
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (kind === 'count') return rows.length;
  if (!values.length) return 0;
  if (kind === 'sum') return values.reduce((a, b) => a + b, 0);
  if (kind === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (kind === 'min') return Math.min(...values);
  if (kind === 'max') return Math.max(...values);
  return 0;
}
