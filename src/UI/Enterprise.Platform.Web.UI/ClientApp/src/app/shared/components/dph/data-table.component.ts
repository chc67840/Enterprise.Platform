/**
 * ─── DPH UI KIT — DATA TABLE ────────────────────────────────────────────────────
 *
 * Universal data table. Wraps PrimeNG <p-table> with safe defaults +
 * config-driven columns + skeleton loading + empty-state delegation.
 *
 *   <dph-data-table
 *     [config]="tableConfig"
 *     [data]="users()"
 *     [loading]="loading()"
 *     [(page)]="page"
 *     [(pageSize)]="pageSize"
 *     [totalRecords]="total()"
 *     (rowClick)="open($event.row)"
 *     (actionClick)="onRowAction($event)"
 *   />
 *
 * Built-in column types: text | number | currency | date | datetime |
 * boolean | badge | actions. `custom` renders nothing (host renders via
 * customColumnTemplates map keyed by column.field).
 */
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { TableModule, type TablePageEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import type {
  ColumnDef,
  PaginationState,
  RowAction,
  Severity,
  SortDirection,
  SortState,
  TableConfig,
} from './dph.types';

@Component({
  selector: 'dph-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe, TableModule, TagModule, TooltipModule],
  template: `
    <p-table
      [value]="$any(loading() ? skeletonRows() : data())"
      [columns]="visibleColumns()"
      [dataKey]="config().idField"
      [paginator]="config().pagination ?? true"
      [rows]="pageSize()"
      [first]="(page() - 1) * pageSize()"
      [totalRecords]="totalRecords() || data().length"
      [rowsPerPageOptions]="$any(config().pageSizes) ?? [10, 25, 50, 100]"
      [lazy]="totalRecords() > 0"
      [scrollable]="!!config().scrollable"
      [scrollHeight]="config().scrollHeight ?? ''"
      [virtualScroll]="!!config().virtualScroll"
      [virtualScrollItemSize]="config().virtualScrollItemSize ?? 48"
      [resizableColumns]="!!config().resizable"
      [columnResizeMode]="'fit'"
      [stripedRows]="config().striped ?? true"
      [showGridlines]="config().gridLines ?? false"
      [globalFilterFields]="$any(config().globalFilterFields) ?? []"
      [selectionMode]="$any(config().selectionMode) ?? null"
      [(selection)]="selectedRows"
      [stateKey]="config().stateKey ?? ''"
      [stateStorage]="config().stateKey ? 'local' : 'session'"
      [attr.aria-busy]="loading()"
      styleClass="dph-table"
      [tableStyleClass]="tableSizeClass()"
      (onPage)="onPage($event)"
      (onSort)="onSort($event)"
    >
      @if (config().caption) {
        <ng-template pTemplate="caption">
          <span class="dph-table__caption">{{ config().caption }}</span>
        </ng-template>
      }

      <ng-template pTemplate="header">
        <tr>
          @if (config().selectionMode === 'multiple') {
            <th style="width: 3rem">
              <p-tableHeaderCheckbox />
            </th>
          }
          @for (col of visibleColumns(); track col.field) {
            <th
              [pSortableColumn]="col.sortable ? col.field : ''"
              [style.width]="col.width || null"
              [style.min-width]="col.minWidth || null"
              [style.text-align]="col.align || null"
              scope="col"
            >
              <span class="dph-table__th">
                {{ col.header }}
                @if (col.sortable) {
                  <p-sortIcon [field]="col.field" />
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

      <ng-template pTemplate="body" let-row let-rowIndex="rowIndex">
        <tr
          [class]="rowClass(row)"
          (click)="emitRowClick(row, $event)"
          (dblclick)="emitRowDblClick(row, $event)"
        >
          @if (config().selectionMode === 'multiple') {
            <td (click)="$event.stopPropagation()">
              <p-tableCheckbox [value]="row" />
            </td>
          }
          @for (col of visibleColumns(); track col.field) {
            <td [style.text-align]="col.align || null">
              @if (loading()) {
                <span class="dph-skeleton-bar"></span>
              } @else {
                @switch (col.type || 'text') {
                  @case ('number') {
                    {{ $any(getValue(row, col.field)) | number: '1.0-2' }}
                  }
                  @case ('currency') {
                    {{ $any(getValue(row, col.field)) | currency: 'USD' }}
                  }
                  @case ('date') {
                    {{ $any(getValue(row, col.field)) | date: 'mediumDate' }}
                  }
                  @case ('datetime') {
                    {{ $any(getValue(row, col.field)) | date: 'medium' }}
                  }
                  @case ('boolean') {
                    <i
                      class="pi"
                      [class.pi-check]="!!getValue(row, col.field)"
                      [class.pi-times]="!getValue(row, col.field)"
                      [style.color]="!!getValue(row, col.field) ? 'var(--ep-color-palmetto-700)' : 'var(--ep-color-neutral-400)'"
                      aria-hidden="true"
                    ></i>
                  }
                  @case ('badge') {
                    <p-tag
                      [value]="formattedValue(row, col)"
                      [severity]="$any(badgeSeverity(getValue(row, col.field)))"
                      [rounded]="true"
                    />
                  }
                  @default {
                    {{ formattedValue(row, col) }}
                  }
                }
              }
            </td>
          }
          @if (config().rowActions?.length) {
            <td class="dph-table__td-actions" (click)="$event.stopPropagation()">
              @for (act of config().rowActions || []; track act.key) {
                @if (actionVisible(act, row)) {
                  <button
                    type="button"
                    class="dph-table__action"
                    [attr.data-severity]="act.severity || 'neutral'"
                    [disabled]="actionDisabled(act, row)"
                    [pTooltip]="act.label"
                    tooltipPosition="left"
                    [attr.aria-label]="act.label"
                    (click)="emitAction(act.key, row)"
                  >
                    <i [class]="act.icon" aria-hidden="true"></i>
                  </button>
                }
              }
            </td>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td [attr.colspan]="emptyColspan()">
            <div class="dph-table__empty" role="status">
              <i [class]="config().emptyIcon || 'pi pi-inbox'" aria-hidden="true"></i>
              <p>{{ config().emptyMessage || 'No data to display.' }}</p>
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [
    `
      :host { display: block; }

      .dph-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }

      :host ::ng-deep .dph-table .p-datatable-table {
        font-size: 0.875rem;
      }
      :host ::ng-deep .dph-table.dph-table--sm .p-datatable-tbody > tr > td,
      :host ::ng-deep .dph-table.dph-table--sm .p-datatable-thead > tr > th {
        padding: 0.375rem 0.5rem;
      }
      :host ::ng-deep .dph-table.dph-table--lg .p-datatable-tbody > tr > td,
      :host ::ng-deep .dph-table.dph-table--lg .p-datatable-thead > tr > th {
        padding: 0.875rem 1rem;
      }

      .dph-table__caption {
        font-weight: 600;
        color: var(--ep-color-neutral-900);
      }
      .dph-table__th {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .dph-table__td-actions,
      .dph-table__th-actions {
        text-align: right;
        white-space: nowrap;
      }

      .dph-table__action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--ep-radius-md);
        background-color: transparent;
        color: var(--ep-color-neutral-600);
        border: none;
        cursor: pointer;
        touch-action: manipulation;
      }
      .dph-table__action:hover { background-color: var(--ep-color-neutral-100); color: var(--ep-color-neutral-900); }
      .dph-table__action:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-table__action[disabled] { opacity: 0.4; cursor: not-allowed; }
      .dph-table__action[data-severity='danger'] { color: var(--ep-color-danger-600); }
      .dph-table__action[data-severity='success'] { color: var(--ep-color-palmetto-700); }
      .dph-table__action[data-severity='warning'] { color: var(--ep-color-jessamine-700); }

      .dph-table__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 3rem 1rem;
        text-align: center;
        color: var(--ep-color-neutral-500);
      }
      .dph-table__empty i {
        font-size: 2.5rem;
        color: var(--ep-color-neutral-300);
      }
      .dph-table__empty p { margin: 0; font-size: 0.875rem; }

      .dph-skeleton-bar {
        display: inline-block;
        width: 80%;
        height: 0.875rem;
        background: linear-gradient(90deg, var(--ep-color-neutral-200), var(--ep-color-neutral-100), var(--ep-color-neutral-200));
        background-size: 200% 100%;
        border-radius: var(--ep-radius-sm);
        animation: dph-skel 1.4s ease infinite;
      }
      @keyframes dph-skel {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dph-skeleton-bar { animation: none; }
      }

      /* mobile horizontal-scroll wrapper (when not using PrimeNG scrollable) */
      @media (max-width: 767px) {
        :host ::ng-deep .dph-table .p-datatable-wrapper { overflow-x: auto; }
      }
    `,
  ],
})
export class DataTableComponent<T extends Record<string, unknown>> {
  readonly config = input.required<TableConfig<T>>();
  readonly data = input<readonly T[]>([]);
  readonly loading = input<boolean>(false);
  readonly totalRecords = input<number>(0);

  readonly selectedRows = model<T[]>([]);
  readonly page = model<number>(1);
  readonly pageSize = model<number>(25);
  readonly sortField = model<string>('');
  readonly sortDirection = model<SortDirection>(null);

  readonly rowClick = output<{ row: T; event: MouseEvent }>();
  readonly rowDblClick = output<{ row: T; event: MouseEvent }>();
  readonly actionClick = output<{ action: string; row: T }>();
  readonly bulkAction = output<{ action: string; rows: readonly T[] }>();
  readonly pageChange = output<PaginationState>();
  readonly sortChange = output<SortState>();
  readonly exportRequest = output<{ format: 'csv' | 'xlsx' | 'pdf'; data: readonly T[] }>();

  protected readonly visibleColumns = computed(() =>
    this.config().columns.filter((c) => c.visible !== false),
  );

  protected readonly skeletonRows = computed<readonly Record<string, unknown>[]>(() => {
    const n = this.config().skeletonRows ?? 5;
    return Array.from({ length: n }, (_, i) => ({ __skeleton: true, __i: i }));
  });

  protected readonly tableSizeClass = computed(() => `dph-table--${this.config().size ?? 'md'}`);

  protected readonly emptyColspan = computed(() => {
    let n = this.visibleColumns().length;
    if (this.config().selectionMode === 'multiple') n += 1;
    if (this.config().rowActions?.length) n += 1;
    return n;
  });

  protected getValue(row: T, field: string): unknown {
    return field.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, row);
  }

  protected formattedValue(row: T, col: ColumnDef<T>): string {
    const raw = this.getValue(row, col.field);
    if (col.format) return col.format(raw, row);
    return raw == null ? '' : String(raw);
  }

  protected rowClass(row: T): string {
    return this.config().rowClass?.(row) ?? '';
  }

  protected actionDisabled(act: RowAction<T>, row: T): boolean {
    return typeof act.disabled === 'function' ? act.disabled(row) : !!act.disabled;
  }

  protected actionVisible(act: RowAction<T>, row: T): boolean {
    if (act.visible === undefined) return true;
    return typeof act.visible === 'function' ? act.visible(row) : act.visible;
  }

  protected badgeSeverity(value: unknown): string {
    if (value === true || value === 'success' || value === 'active') return 'success';
    if (value === false || value === 'inactive') return 'secondary';
    if (value === 'warning') return 'warn';
    if (value === 'danger' || value === 'error') return 'danger';
    return 'info';
  }

  protected emitRowClick(row: T, event: MouseEvent): void {
    this.rowClick.emit({ row, event });
  }
  protected emitRowDblClick(row: T, event: MouseEvent): void {
    this.rowDblClick.emit({ row, event });
  }
  protected emitAction(action: string, row: T): void {
    this.actionClick.emit({ action, row });
  }

  protected onPage(event: TablePageEvent): void {
    const newPage = Math.floor(event.first / event.rows) + 1;
    this.page.set(newPage);
    this.pageSize.set(event.rows);
    const sizes: readonly number[] = this.config().pageSizes ?? [10, 25, 50, 100];
    this.pageChange.emit({
      page: newPage,
      pageSize: event.rows,
      total: this.totalRecords() || this.data().length,
      pageSizes: sizes,
    });
  }

  protected onSort(event: { field?: string; order?: number }): void {
    const dir: SortDirection = event.order === 1 ? 'asc' : event.order === -1 ? 'desc' : null;
    this.sortField.set(event.field || '');
    this.sortDirection.set(dir);
    this.sortChange.emit({ field: event.field || '', direction: dir });
  }
}
