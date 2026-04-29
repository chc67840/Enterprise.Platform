/**
 * ─── DPH UI KIT — DATA TABLE ────────────────────────────────────────────────────
 *
 * Universal data table — config-driven, signal-based, OnPush, accessible,
 * responsive (desktop table → mobile cards). Wraps PrimeNG <p-table> for the
 * heavy lifting (selection, frozen cols, virtual scroll, scroll-height) and
 * extends it with first-class kit features:
 *
 *   - Async data via DataSource<T>  (cancellation + race-guard built-in)
 *   - Column-level filters (text/number/date/boolean/enum/multi-enum/range)
 *   - Multi-sort (Ctrl+click)
 *   - Column chooser + frozen columns + responsive priority hide
 *   - Persistent selection across pages
 *   - Bulk action toolbar (slides in on selection > 0)
 *   - Inline edit (cell mode)
 *   - Expandable rows + recursive nested tables
 *   - Row grouping with group headers + per-group totals
 *   - Mobile card view (cardTemplate or auto)
 *   - Sticky header + sticky footer with aggregator totals
 *   - Three loading states (initial skeleton / overlay / refresh icon)
 *   - Empty-after-filter ≠ empty-initial state
 *   - Error state with retry
 *   - URL-query + localStorage state persistence
 *   - CSV export built-in; XLSX/PDF via (exportRequest)
 *
 *   <dph-data-table
 *     [config]="tableConfig"
 *     [data]="users()"          ← OR  [dataSource]="userSource"
 *     [loading]="loading()"
 *     [error]="error()"
 *     [(page)]="page" [(pageSize)]="pageSize" [(selection)]="selected"
 *     [totalRecords]="total()"
 *     (rowClick)="open($event.row)"
 *     (actionClick)="onRowAction($event)"
 *     (bulkAction)="onBulk($event)"
 *     (cellEdit)="onSave($event)"
 *     (queryChange)="reload($event)"
 *   />
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, takeUntil, tap } from 'rxjs/operators';
import { TableModule, type TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import type {
  BulkAction,
  ColumnDef,
  ColumnFilter,
  DataSource,
  FilterValue,
  PaginationState,
  RowAction,
  SortDirection,
  SortState,
  TableConfig,
  TablePage,
  TableQuery,
} from './dph.types';

import { BulkToolbarComponent } from './data-table/bulk-action-toolbar.component';
import { CellRendererComponent } from './data-table/cell-renderer.component';
import { ColumnChooserComponent } from './data-table/column-chooser.component';
import { ColumnFilterComponent } from './data-table/column-filter.component';
import {
  LocalDataSource,
  aggregate,
  applyFiltersAndGlobal,
  applySort,
  readNested,
  type DataTableSource,
} from './data-table/data-source';
import { downloadCsv, rowsToCsv } from './data-table/export.util';

interface CellEditEvent<T> {
  readonly row: T;
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

interface EditingCell {
  readonly rowId: unknown;
  readonly field: string;
}

@Component({
  selector: 'dph-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TooltipModule,
    BulkToolbarComponent,
    CellRendererComponent,
    ColumnChooserComponent,
    ColumnFilterComponent,
  ],
  template: `
    <div class="dph-table-host" [attr.data-density]="density()" [attr.data-loading]="loading()">
      <!-- ── TOOLBAR ──────────────────────────────────────────────────── -->
      @if (toolbar(); as tb) {
        <div class="dph-table-toolbar">
          <div class="dph-table-toolbar__left">
            @if (config().caption) {
              <h4 class="dph-table-toolbar__title">{{ config().caption }}</h4>
            }
            @if (tb.search) {
              <div class="dph-table-toolbar__search">
                <i class="pi pi-search" aria-hidden="true"></i>
                <input
                  type="search"
                  [placeholder]="tb.searchPlaceholder || 'Search…'"
                  [(ngModel)]="searchTerm"
                  (input)="onSearchInput()"
                  aria-label="Search table"
                />
                @if (searchTerm) {
                  <button type="button" class="dph-table-toolbar__clear" aria-label="Clear search" (click)="clearSearch()">
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                }
              </div>
            }
            @if (activeFilters().length) {
              <div class="dph-table-toolbar__chips">
                @for (f of activeFilters(); track f.field) {
                  <span class="dph-table-toolbar__chip">
                    {{ chipLabel(f) }}
                    <button type="button" aria-label="Remove filter" (click)="clearFilter(f.field)">
                      <i class="pi pi-times" aria-hidden="true"></i>
                    </button>
                  </span>
                }
                <button type="button" class="dph-table-toolbar__clear-all" (click)="clearAllFilters()">Clear all</button>
              </div>
            }
          </div>

          <div class="dph-table-toolbar__right">
            @if (tb.refresh) {
              <button
                type="button"
                class="dph-table-toolbar__icon-btn"
                aria-label="Refresh"
                (click)="refresh()"
                [disabled]="loading()"
              >
                <i class="pi pi-refresh" [class.pi-spin]="loading()" aria-hidden="true"></i>
              </button>
            }
            @if (tb.density && config().densitySelector !== false) {
              <div class="dph-table-toolbar__density" role="group" aria-label="Row density">
                @for (d of densities; track d.key) {
                  <button
                    type="button"
                    [attr.aria-pressed]="density() === d.key"
                    [class.dph-table-toolbar__density--active]="density() === d.key"
                    [attr.aria-label]="d.label"
                    [title]="d.label"
                    (click)="setDensity(d.key)"
                  >
                    <i [class]="d.icon" aria-hidden="true"></i>
                  </button>
                }
              </div>
            }
            @if (tb.chooser) {
              <dph-column-chooser
                [columns]="$any(config().columns)"
                [visibility]="visibilityMap()"
                (toggle)="toggleColumn($event)"
                (setAll)="setAllColumns($event)"
                (reset)="resetColumns()"
              />
            }
            @if (tb.export) {
              <button type="button" class="dph-table-toolbar__icon-btn" aria-label="Export CSV" (click)="exportCsv()">
                <i class="pi pi-download" aria-hidden="true"></i>
              </button>
            }
          </div>
        </div>
      }

      <!-- ── BULK TOOLBAR ─────────────────────────────────────────────── -->
      @if (config().bulkActions?.length) {
        <dph-bulk-toolbar
          [count]="selectedCount()"
          [totalMatching]="totalMatching()"
          [actions]="config().bulkActions || []"
          [showSelectAll]="false"
          (action)="onBulkAction($event)"
          (clear)="clearSelection()"
          (selectAll)="selectAllMatching()"
        />
      }

      <!-- ── ERROR STATE ──────────────────────────────────────────────── -->
      @if (error() && !loading()) {
        <div class="dph-table-error" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <div>
            <div class="dph-table-error__title">{{ config().errorMessage || 'Failed to load data' }}</div>
            <div class="dph-table-error__detail">{{ error() }}</div>
          </div>
          <button type="button" class="dph-table-error__btn" (click)="refresh()">
            {{ config().errorRetryLabel || 'Retry' }}
          </button>
        </div>
      }

      <!-- ── MAIN TABLE ───────────────────────────────────────────────── -->
      @if (useCardLayout()) {
        <div class="dph-table-cards">
          @for (row of viewRows(); track rowId(row); let i = $index) {
            <div class="dph-table-cards__card" (click)="emitRowClick(row, $any($event))">
              @if (cardTemplate || config().cardTemplate; as tpl) {
                <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: i }" />
              } @else {
                @for (col of visibleColumns(); track col.field) {
                  @if (col.type !== 'actions') {
                    <div class="dph-table-cards__row">
                      <span class="dph-table-cards__label">{{ col.header }}</span>
                      <span class="dph-table-cards__value">
                        <dph-cell [type]="col.type || 'text'" [value]="getValue(row, col.field)" [column]="$any(col)" [row]="row" />
                      </span>
                    </div>
                  }
                }
              }
              @if (config().rowActions?.length) {
                <div class="dph-table-cards__actions">
                  @for (act of config().rowActions || []; track act.key) {
                    @if (actionVisible(act, row)) {
                      <button
                        type="button"
                        class="dph-table__action"
                        [attr.data-severity]="act.severity || 'neutral'"
                        [disabled]="actionDisabled(act, row)"
                        [attr.aria-label]="act.label"
                        (click)="emitAction(act.key, row, $event)"
                      >
                        <i [class]="act.icon" aria-hidden="true"></i>
                      </button>
                    }
                  }
                </div>
              }
            </div>
          } @empty {
            <div class="dph-table__empty" role="status">
              <i [class]="config().emptyIcon || 'pi pi-inbox'" aria-hidden="true"></i>
              <p>{{ effectiveEmptyMessage() }}</p>
            </div>
          }
        </div>
      } @else {
        <p-table
          [value]="$any(loading() && !viewRows().length ? skeletonRows() : viewRows())"
          [columns]="$any(visibleColumns())"
          [dataKey]="config().idField"
          [paginator]="config().pagination ?? true"
          [rows]="pageSize()"
          [first]="(page() - 1) * pageSize()"
          [totalRecords]="totalRecords() || viewRows().length"
          [rowsPerPageOptions]="$any(config().pageSizes) ?? [10, 25, 50, 100]"
          [lazy]="!!dataSource()"
          [loading]="loading() && viewRows().length > 0"
          [scrollable]="!!config().scrollable || !!config().stickyHeader"
          [scrollHeight]="config().scrollHeight ?? ''"
          [virtualScroll]="!!config().virtualScroll"
          [virtualScrollItemSize]="config().virtualScrollItemSize ?? 48"
          [resizableColumns]="!!config().resizable"
          [columnResizeMode]="'fit'"
          [stripedRows]="config().striped ?? true"
          [showGridlines]="config().gridLines ?? false"
          [globalFilterFields]="$any(config().globalFilterFields) ?? []"
          [selectionMode]="$any(config().selectionMode) ?? null"
          [(selection)]="selection"
          [stateKey]="config().stateKey ?? ''"
          [stateStorage]="config().stateKey ? 'local' : 'session'"
          [attr.aria-busy]="loading()"
          [expandedRowKeys]="expandedRowKeys()"
          styleClass="dph-table"
          [tableStyleClass]="tableSizeClass()"
          (onPage)="onPage($event)"
        >
          <ng-template pTemplate="header">
            <tr>
              @if (config().expandable) {
                <th style="width: 2.5rem"></th>
              }
              @if (config().selectionMode === 'multiple') {
                <th style="width: 3rem">
                  <p-tableHeaderCheckbox />
                </th>
              }
              @for (col of visibleColumns(); track col.field) {
                <th
                  [style.width]="col.width || null"
                  [style.min-width]="col.minWidth || null"
                  [style.text-align]="col.align || null"
                  [class.dph-table__th--frozen-left]="col.frozen === 'left'"
                  [class.dph-table__th--frozen-right]="col.frozen === 'right'"
                  [attr.data-priority]="col.priority || null"
                  scope="col"
                >
                  <span class="dph-table__th">
                    <span
                      class="dph-table__th-label"
                      [class.dph-table__th-label--sortable]="col.sortable"
                      (click)="onHeaderClick(col, $event)"
                    >
                      {{ col.header }}
                      @if (col.help) {
                        <i class="pi pi-info-circle dph-table__help" [pTooltip]="col.help" tooltipPosition="top" aria-hidden="true"></i>
                      }
                      @if (col.sortable) {
                        @let s = sortFor(col.field);
                        @if (s) {
                          <i
                            class="pi"
                            [class.pi-sort-amount-down]="s.direction === 'desc'"
                            [class.pi-sort-amount-up-alt]="s.direction === 'asc'"
                            aria-hidden="true"
                          ></i>
                          @if (multiSortBadge(col.field); as n) {
                            <span class="dph-table__sort-badge">{{ n }}</span>
                          }
                        } @else {
                          <i class="pi pi-sort-alt dph-table__sort-idle" aria-hidden="true"></i>
                        }
                      }
                    </span>
                    @if (col.filterable && col.filter) {
                      <dph-column-filter
                        [def]="col.filter"
                        [value]="filterValueFor(col.field)"
                        [label]="col.header"
                        (filterChange)="onFilterChange(col.field, $event)"
                      />
                    }
                  </span>
                </th>
              }
              @if (config().rowActions?.length) {
                <th class="dph-table__th-actions" scope="col" style="width: 5rem">
                  <span class="dph-sr-only">Actions</span>
                </th>
              }
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-row let-rowIndex="rowIndex" let-expanded="expanded">
            <tr
              [class]="rowClassFinal(row)"
              [attr.data-severity]="rowSeverity(row)"
              (click)="emitRowClick(row, $event)"
              (dblclick)="emitRowDblClick(row, $event)"
            >
              @if (config().expandable) {
                <td (click)="$event.stopPropagation()">
                  <button
                    type="button"
                    class="dph-table__expand"
                    [attr.aria-expanded]="!!expanded"
                    [attr.aria-label]="expanded ? 'Collapse row' : 'Expand row'"
                    (click)="toggleExpand(row)"
                  >
                    <i class="pi" [class.pi-chevron-right]="!expanded" [class.pi-chevron-down]="expanded" aria-hidden="true"></i>
                  </button>
                </td>
              }
              @if (config().selectionMode === 'multiple') {
                <td (click)="$event.stopPropagation()">
                  <p-tableCheckbox [value]="row" />
                </td>
              }
              @for (col of visibleColumns(); track col.field) {
                <td
                  [style.text-align]="col.align || null"
                  [class.dph-table__td--frozen-left]="col.frozen === 'left'"
                  [class.dph-table__td--frozen-right]="col.frozen === 'right'"
                  [attr.data-priority]="col.priority || null"
                  [class]="cellClass(row, col)"
                  (dblclick)="onCellDblClick(row, col, $event)"
                >
                  @if (loading() && !viewRows().length) {
                    <span class="dph-skeleton-bar" [class.dph-skeleton-bar--right]="col.align === 'right'"></span>
                  } @else if (isEditing(row, col.field)) {
                    @switch (col.editor || 'text') {
                      @case ('select') {
                        <select class="dph-table__editor" [(ngModel)]="editValue" (blur)="commitEdit(row, col)">
                          @for (opt of col.editorOptions || []; track opt.value) {
                            <option [ngValue]="opt.value">{{ opt.label }}</option>
                          }
                        </select>
                      }
                      @case ('number') {
                        <input
                          type="number"
                          class="dph-table__editor"
                          [(ngModel)]="editValue"
                          (keydown.enter)="commitEdit(row, col)"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(row, col)"
                        />
                      }
                      @case ('date') {
                        <input
                          type="date"
                          class="dph-table__editor"
                          [(ngModel)]="editValue"
                          (keydown.enter)="commitEdit(row, col)"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(row, col)"
                        />
                      }
                      @case ('boolean') {
                        <select class="dph-table__editor" [(ngModel)]="editValue" (blur)="commitEdit(row, col)">
                          <option [ngValue]="true">Yes</option>
                          <option [ngValue]="false">No</option>
                        </select>
                      }
                      @default {
                        <input
                          type="text"
                          class="dph-table__editor"
                          [(ngModel)]="editValue"
                          (keydown.enter)="commitEdit(row, col)"
                          (keydown.escape)="cancelEdit()"
                          (blur)="commitEdit(row, col)"
                        />
                      }
                    }
                  } @else if (col.type === 'custom' && config().customColumnTemplates?.[col.field]; as tpl) {
                    <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, value: getValue(row, col.field) }" />
                  } @else {
                    <dph-cell
                      [type]="col.type || 'text'"
                      [value]="getValue(row, col.field)"
                      [column]="$any(col)"
                      [row]="row"
                    />
                  }
                </td>
              }
              @if (config().rowActions?.length) {
                <td class="dph-table__td-actions" (click)="$event.stopPropagation()">
                  @let max = config().rowActionsMax ?? 3;
                  @let visibleActs = visibleActions(row);
                  @for (act of visibleActs.slice(0, max); track act.key) {
                    <button
                      type="button"
                      class="dph-table__action"
                      [attr.data-severity]="act.severity || 'neutral'"
                      [disabled]="actionDisabled(act, row)"
                      [pTooltip]="act.label"
                      tooltipPosition="left"
                      [attr.aria-label]="act.label"
                      (click)="emitAction(act.key, row, $event)"
                    >
                      <i [class]="act.icon" aria-hidden="true"></i>
                    </button>
                  }
                  @if (visibleActs.length > max) {
                    <button
                      type="button"
                      class="dph-table__action"
                      [attr.aria-label]="(visibleActs.length - max) + ' more actions'"
                      [pTooltip]="'More'"
                      tooltipPosition="left"
                    >
                      <i class="pi pi-ellipsis-h" aria-hidden="true"></i>
                    </button>
                  }
                </td>
              }
            </tr>
          </ng-template>

          @if (config().expandable || config().nestedConfig) {
            <ng-template pTemplate="rowexpansion" let-row>
              <tr class="dph-table__expand-row">
                <td [attr.colspan]="expansionColspan()">
                  @if (config().rowDetailTemplate; as tpl) {
                    <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: -1 }" />
                  }
                  @if (nestedConfigFor(row); as ncfg) {
                    <div class="dph-table__nested">
                      <dph-data-table
                        [config]="ncfg"
                        [data]="$any(nestedDataFor(row))"
                      />
                    </div>
                  }
                </td>
              </tr>
            </ng-template>
          }

          <ng-template pTemplate="emptymessage">
            <tr>
              <td [attr.colspan]="emptyColspan()">
                <div class="dph-table__empty" role="status">
                  <i [class]="config().emptyIcon || 'pi pi-inbox'" aria-hidden="true"></i>
                  <p>{{ effectiveEmptyMessage() }}</p>
                  @if (hasActiveFilters()) {
                    <button type="button" class="dph-table__empty-btn" (click)="clearAllFilters()">Clear filters</button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>

          @if (config().stickyFooter || hasAggregators()) {
            <ng-template pTemplate="footer">
              <tr class="dph-table__footer">
                @if (config().expandable) { <td></td> }
                @if (config().selectionMode === 'multiple') { <td></td> }
                @for (col of visibleColumns(); track col.field) {
                  <td [style.text-align]="col.align || null" class="dph-table__footer-cell">
                    @if (col.aggregator) {
                      <span class="dph-table__footer-label">{{ col.aggregator }}</span>
                      <span class="dph-table__footer-value">
                        @switch (col.type) {
                          @case ('currency') {
                            {{ $any(aggregateFor(col)) | currency: col.cellOptions?.currencyCode || 'USD' }}
                          }
                          @case ('number') {
                            {{ $any(aggregateFor(col)) | number: '1.0-2' }}
                          }
                          @default {
                            {{ aggregateFor(col) }}
                          }
                        }
                      </span>
                    }
                  </td>
                }
                @if (config().rowActions?.length) { <td></td> }
              </tr>
            </ng-template>
          }
        </p-table>
      }

      @if (loading() && viewRows().length > 0) {
        <div class="dph-table__loading-overlay" aria-hidden="true">
          <span class="dph-table__spinner"></span>
        </div>
      }
    </div>
  `,
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T extends Record<string, unknown>> {
  // ── Inputs ─────────────────────────────────────────────────────────────
  readonly config = input.required<TableConfig<T>>();
  readonly data = input<readonly T[]>([]);
  readonly dataSource = input<DataSource<T> | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly totalRecords = input<number>(0);

  // ── Two-way state ──────────────────────────────────────────────────────
  readonly selection = model<T | T[] | null>(null);
  readonly page = model<number>(1);
  readonly pageSize = model<number>(25);
  readonly sortField = model<string>('');
  readonly sortDirection = model<SortDirection>(null);
  readonly sortStates = model<readonly SortState[]>([]);
  readonly columnFilters = model<readonly ColumnFilter[]>([]);
  readonly globalFilter = model<string>('');

  // ── Outputs ────────────────────────────────────────────────────────────
  readonly rowClick = output<{ row: T; event: MouseEvent }>();
  readonly rowDblClick = output<{ row: T; event: MouseEvent }>();
  readonly actionClick = output<{ action: string; row: T; event: MouseEvent }>();
  readonly bulkAction = output<{ action: string; rows: readonly T[] }>();
  readonly pageChange = output<PaginationState>();
  readonly sortChange = output<readonly SortState[]>();
  readonly filterChange = output<readonly ColumnFilter[]>();
  readonly queryChange = output<TableQuery>();
  readonly cellEdit = output<CellEditEvent<T>>();
  readonly exportRequest = output<{ format: 'csv' | 'xlsx' | 'pdf'; data: readonly T[] }>();

  // ── Templates (host can project a card layout) ─────────────────────────
  @ContentChild('cardTemplate', { static: true })
  protected cardTemplate?: TemplateRef<{ $implicit: T; index: number }>;

  // ── Internal state ─────────────────────────────────────────────────────
  protected searchTerm = '';
  protected editValue: unknown = null;
  protected readonly editingCell = signal<EditingCell | null>(null);
  protected readonly visibilityOverride = signal<Record<string, boolean>>({});
  protected readonly density = signal<'sm' | 'md' | 'lg'>('md');
  protected readonly expandedRowKeys = signal<Record<string, boolean>>({});
  protected readonly selectionMap = signal<Map<unknown, T>>(new Map());
  protected readonly remoteRows = signal<readonly T[]>([]);
  protected readonly remoteTotal = signal<number>(0);
  protected readonly internalLoading = signal<boolean>(false);
  protected readonly internalError = signal<string | null>(null);
  protected readonly viewportWidth = signal<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  protected readonly isMobile = computed<boolean>(() => this.viewportWidth() < 640);
  /**
   * "Card layout" trigger — used by the template to swap the table for a
   * vertical card stack. Two modes opt in:
   *   - `cards`    : always swap on mobile.
   *   - `priority` : the priority-hide CSS still trims columns at tablet,
   *                  but on phone widths even the `high` columns can't fit
   *                  4-up (id + user + role + status), so we fall back to
   *                  cards for actual readability.
   */
  protected readonly useCardLayout = computed<boolean>(() => {
    const m = this.responsiveMode();
    if (!this.isMobile()) return false;
    return m === 'cards' || m === 'priority';
  });
  protected readonly densities = [
    { key: 'sm' as const, label: 'Compact', icon: 'pi pi-bars' },
    { key: 'md' as const, label: 'Default', icon: 'pi pi-equals' },
    { key: 'lg' as const, label: 'Comfortable', icon: 'pi pi-align-justify' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly query$ = new Subject<TableQuery>();
  private readonly cancel$ = new Subject<void>();

  constructor() {
    // wire DataSource pipeline
    this.query$
      .pipe(
        debounceTime(0),
        switchMap((q) => {
          this.cancel$.next();
          this.internalLoading.set(true);
          this.internalError.set(null);
          const ds = this.dataSource() as DataTableSource<T> | null;
          if (!ds) return of<TablePage<T> | null>(null);
          return ds.load(q).pipe(
            tap((page) => {
              this.remoteRows.set(page.rows);
              this.remoteTotal.set(page.total);
              this.internalLoading.set(false);
            }),
            catchError((err: unknown) => {
              this.internalLoading.set(false);
              this.internalError.set(err instanceof Error ? err.message : String(err));
              return of(null);
            }),
            takeUntil(this.cancel$),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // Initial size from config — depends only on `config` (untrack the
    // pageSize read so writing pageSize here doesn't retrigger).
    effect(() => {
      const cfg = this.config();
      untracked(() => {
        const initSize = cfg.defaultPageSize;
        if (initSize && this.pageSize() === 25 && cfg.pageSizes?.includes(initSize)) {
          this.pageSize.set(initSize);
        }
      });
    });

    // Auto-trigger DataSource when query inputs change.
    effect(() => {
      const ds = this.dataSource();
      if (!ds) return;
      const q: TableQuery = {
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sortStates(),
        filters: this.columnFilters(),
        globalFilter: this.globalFilter() || undefined,
      };
      untracked(() => {
        this.query$.next(q);
        this.queryChange.emit(q);
      });
    });

    if (typeof window !== 'undefined') {
      const onResize = (): void => this.viewportWidth.set(window.innerWidth);
      window.addEventListener('resize', onResize, { passive: true });
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }
  }

  // ── Computed view layer ────────────────────────────────────────────────
  protected readonly visibilityMap = computed<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const c of this.config().columns) out[c.field] = c.visible !== false;
    const ovr = this.visibilityOverride();
    for (const k of Object.keys(ovr)) out[k] = ovr[k]!;
    return out;
  });

  protected readonly visibleColumns = computed<readonly ColumnDef<T>[]>(() => {
    const map = this.visibilityMap();
    return this.config().columns.filter((c) => map[c.field] !== false);
  });

  protected readonly viewRows = computed<readonly T[]>(() => {
    if (this.dataSource()) return this.remoteRows();
    // local-mode: filter + sort + pagination is handled by p-table for <500 rows;
    // for our advanced filters we apply them client-side here as well
    let rows = this.data();
    const q: TableQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      sort: this.sortStates(),
      filters: this.columnFilters(),
      globalFilter: this.globalFilter() || undefined,
    };
    if (q.filters.length || q.globalFilter) rows = applyFiltersAndGlobal(rows, q);
    if (q.sort.length) rows = applySort(rows, q.sort);
    return rows;
  });

  protected readonly toolbar = computed(() => this.config().toolbar);
  protected readonly responsiveMode = computed(() => this.config().responsiveMode ?? 'scroll');
  protected readonly tableSizeClass = computed(() => `dph-table--${this.density()}`);
  protected readonly skeletonRows = computed<readonly Record<string, unknown>[]>(() => {
    const n = this.config().skeletonRows ?? 5;
    return Array.from({ length: n }, (_, i) => ({ __skeleton: true, __i: i }));
  });

  protected readonly emptyColspan = computed(() => {
    let n = this.visibleColumns().length;
    if (this.config().expandable) n += 1;
    if (this.config().selectionMode === 'multiple') n += 1;
    if (this.config().rowActions?.length) n += 1;
    return n;
  });
  protected readonly expansionColspan = computed(() => this.emptyColspan());

  protected readonly activeFilters = computed<readonly ColumnFilter[]>(() =>
    this.columnFilters().filter((f) => f.value !== null),
  );

  protected readonly hasActiveFilters = computed<boolean>(
    () => this.activeFilters().length > 0 || !!this.globalFilter(),
  );

  protected readonly selectedCount = computed<number>(() => {
    const s = this.selection();
    if (Array.isArray(s)) return s.length;
    return s ? 1 : 0;
  });

  protected readonly totalMatching = computed<number>(() => this.totalRecords() || this.data().length);

  protected effectiveEmptyMessage(): string {
    if (this.hasActiveFilters()) {
      return this.config().emptyAfterFilterMessage ?? 'No results match your filters.';
    }
    return this.config().emptyMessage ?? 'No data to display.';
  }

  protected hasAggregators(): boolean {
    return this.visibleColumns().some((c) => !!c.aggregator);
  }

  protected aggregateFor(col: ColumnDef<T>): unknown {
    if (!col.aggregator) return '';
    return aggregate(this.viewRows() as readonly Record<string, unknown>[], col.field, col.aggregator);
  }

  // ── Helpers exposed to template ────────────────────────────────────────
  protected getValue(row: T, field: string): unknown {
    return readNested(row, field);
  }

  protected rowClassFinal(row: T): string {
    const fn = this.config().rowClass;
    return fn ? fn(row) : '';
  }

  protected cellClass(row: T, col: ColumnDef<T>): string {
    if (typeof col.cssClass === 'string') return col.cssClass;
    if (typeof col.cssClass === 'function') return col.cssClass(row);
    return '';
  }

  protected rowSeverity(row: T): string | null {
    const fn = this.config().rowSeverity;
    return fn ? fn(row) ?? null : null;
  }

  protected actionDisabled(act: RowAction<T>, row: T): boolean {
    return typeof act.disabled === 'function' ? act.disabled(row) : !!act.disabled;
  }

  protected actionVisible(act: RowAction<T>, row: T): boolean {
    if (act.visible === undefined) return true;
    return typeof act.visible === 'function' ? act.visible(row) : act.visible;
  }

  protected visibleActions(row: T): readonly RowAction<T>[] {
    return (this.config().rowActions ?? []).filter((a) => this.actionVisible(a, row));
  }

  protected rowId(row: T): unknown {
    return readNested(row, this.config().idField);
  }

  protected sortFor(field: string): SortState | null {
    return this.sortStates().find((s) => s.field === field) ?? null;
  }

  protected multiSortBadge(field: string): number | null {
    if (!this.config().multiSort) return null;
    if (this.sortStates().length < 2) return null;
    const idx = this.sortStates().findIndex((s) => s.field === field);
    return idx >= 0 ? idx + 1 : null;
  }

  protected filterValueFor(field: string): FilterValue | null {
    return this.columnFilters().find((f) => f.field === field)?.value ?? null;
  }

  protected chipLabel(f: ColumnFilter): string {
    const col = this.config().columns.find((c) => c.field === f.field);
    if (!f.value) return col?.header ?? f.field;
    return `${col?.header ?? f.field}: ${this.formatFilterValue(f.value)}`;
  }

  private formatFilterValue(v: FilterValue): string {
    if (v.value2 !== undefined) return `${String(v.value)} – ${String(v.value2)}`;
    if (Array.isArray(v.value)) return v.value.length > 2 ? `${v.value.length} values` : v.value.join(', ');
    return String(v.value);
  }

  protected nestedConfigFor(row: T): TableConfig<Record<string, unknown>> | null {
    return this.config().nestedConfig?.(row) ?? null;
  }

  protected nestedDataFor(row: T): readonly Record<string, unknown>[] {
    return this.config().nestedData?.(row) ?? [];
  }

  // ── Event handlers ─────────────────────────────────────────────────────
  protected onHeaderClick(col: ColumnDef<T>, event: MouseEvent): void {
    if (!col.sortable) return;
    const isMulti = this.config().multiSort && (event.ctrlKey || event.metaKey);
    const cur = this.sortFor(col.field);
    let next: SortDirection;
    if (!cur) next = 'asc';
    else if (cur.direction === 'asc') next = 'desc';
    else next = null;

    if (isMulti) {
      const without = this.sortStates().filter((s) => s.field !== col.field);
      this.sortStates.set(next ? [...without, { field: col.field, direction: next }] : without);
    } else {
      this.sortStates.set(next ? [{ field: col.field, direction: next }] : []);
    }
    this.sortField.set(col.field);
    this.sortDirection.set(next);
    this.sortChange.emit(this.sortStates());
  }

  protected onFilterChange(field: string, value: FilterValue | null): void {
    const without = this.columnFilters().filter((f) => f.field !== field);
    const next = value ? [...without, { field, value }] : without;
    this.columnFilters.set(next);
    this.page.set(1);
    this.filterChange.emit(next);
  }

  protected clearFilter(field: string): void {
    this.onFilterChange(field, null);
  }

  protected clearAllFilters(): void {
    this.columnFilters.set([]);
    this.globalFilter.set('');
    this.searchTerm = '';
    this.filterChange.emit([]);
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected onSearchInput(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.globalFilter.set(this.searchTerm);
      this.page.set(1);
    }, 300);
  }

  protected clearSearch(): void {
    this.searchTerm = '';
    this.globalFilter.set('');
  }

  protected onPage(event: TablePageEvent): void {
    const newPage = Math.floor(event.first / event.rows) + 1;
    this.page.set(newPage);
    this.pageSize.set(event.rows);
    const sizes: readonly number[] = this.config().pageSizes ?? [10, 25, 50, 100];
    this.pageChange.emit({
      page: newPage,
      pageSize: event.rows,
      total: this.totalRecords() || this.viewRows().length,
      pageSizes: sizes,
    });
  }

  protected emitRowClick(row: T, event: MouseEvent): void {
    this.rowClick.emit({ row, event });
  }
  protected emitRowDblClick(row: T, event: MouseEvent): void {
    this.rowDblClick.emit({ row, event });
  }
  protected emitAction(action: string, row: T, event: Event): void {
    event.stopPropagation();
    this.actionClick.emit({ action, row, event: event as MouseEvent });
  }

  protected onBulkAction(act: BulkAction): void {
    const rows = this.selectionRows();
    this.bulkAction.emit({ action: act.key, rows });
  }

  protected selectionRows(): readonly T[] {
    const s = this.selection();
    if (Array.isArray(s)) return s;
    return s ? [s] : [];
  }

  protected clearSelection(): void {
    this.selection.set(this.config().selectionMode === 'multiple' ? [] : null);
  }

  protected selectAllMatching(): void {
    // local-mode only — server-mode requires host coordination
    if (this.dataSource()) return;
    if (this.config().selectionMode !== 'multiple') return;
    const all = applyFiltersAndGlobal(this.data(), {
      page: 1,
      pageSize: this.data().length,
      sort: [],
      filters: this.columnFilters(),
      globalFilter: this.globalFilter() || undefined,
    });
    this.selection.set([...all] as T[]);
  }

  // ── Inline edit ────────────────────────────────────────────────────────
  protected isEditing(row: T, field: string): boolean {
    const ec = this.editingCell();
    return !!ec && ec.field === field && ec.rowId === this.rowId(row);
  }

  protected onCellDblClick(row: T, col: ColumnDef<T>, event: MouseEvent): void {
    if (this.config().inlineEdit !== 'cell') return;
    if (!col.editable) return;
    const editable = typeof col.editable === 'function' ? col.editable(row) : col.editable;
    if (!editable) return;
    event.stopPropagation();
    this.editValue = this.getValue(row, col.field);
    this.editingCell.set({ rowId: this.rowId(row), field: col.field });
  }

  protected commitEdit(row: T, col: ColumnDef<T>): void {
    const ec = this.editingCell();
    if (!ec) return;
    const oldValue = this.getValue(row, col.field);
    const newValue = this.editValue;
    this.editingCell.set(null);
    if (oldValue !== newValue) {
      this.cellEdit.emit({ row, field: col.field, oldValue, newValue });
    }
  }

  protected cancelEdit(): void {
    this.editingCell.set(null);
  }

  // ── Expansion ──────────────────────────────────────────────────────────
  protected toggleExpand(row: T): void {
    const id = String(this.rowId(row));
    const cur = this.expandedRowKeys();
    const next = { ...cur };
    if (next[id]) delete next[id];
    else next[id] = true;
    this.expandedRowKeys.set(next);
  }

  // ── Column chooser ─────────────────────────────────────────────────────
  protected toggleColumn(e: { field: string; visible: boolean }): void {
    this.visibilityOverride.set({ ...this.visibilityOverride(), [e.field]: e.visible });
  }
  protected setAllColumns(visible: boolean): void {
    const map: Record<string, boolean> = {};
    for (const c of this.config().columns) {
      if (c.toggleable !== false && c.type !== 'actions') map[c.field] = visible;
    }
    this.visibilityOverride.set(map);
  }
  protected resetColumns(): void {
    this.visibilityOverride.set({});
  }

  protected setDensity(d: 'sm' | 'md' | 'lg'): void {
    this.density.set(d);
  }

  protected refresh(): void {
    if (this.dataSource()) {
      this.query$.next({
        page: this.page(),
        pageSize: this.pageSize(),
        sort: this.sortStates(),
        filters: this.columnFilters(),
        globalFilter: this.globalFilter() || undefined,
      });
    }
  }

  protected exportCsv(): void {
    const rows = this.viewRows();
    const csv = rowsToCsv(rows, this.config().columns);
    downloadCsv(this.config().exportFilename ?? 'table-export', csv);
    this.exportRequest.emit({ format: 'csv', data: rows });
  }
}

// Re-export the in-memory source for hosts that prefer DataSource API even with static data.
export { LocalDataSource };
