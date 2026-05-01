/**
 * ─── DPH UI KIT — TABLE PICKER ──────────────────────────────────────────────────
 *
 * Row-pick from a `<dph-data-table>`. Wraps the table in field chrome so it
 * behaves like a form input — bound `value` is the selected row's `idField`
 * value (or array thereof for multi-select).
 *
 *   <dph-table-picker
 *     [(value)]="customerId"
 *     [config]="{
 *       label: 'Customer',
 *       tableConfig: { columns, idField: 'id', selectionMode: 'single' },
 *       rows: customers(),
 *       required: true,
 *     }"
 *   />
 *
 * VALUE SHAPE
 *   - `selectionMode: 'single'`   → bound value = `tableConfig.idField` of the chosen row.
 *   - `selectionMode: 'multiple'` → bound value = `readonly` array of those ids.
 *
 *   Whole-row access is intentionally NOT exposed via `value` — host code
 *   that needs the full row should keep its own `rows` reference indexed by
 *   id. Keeping the form payload primitive matches `dph-select`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { generateUuid } from '@utils';

import { DataTableComponent } from './data-table.component';
import { FieldErrorComponent } from './field-error.component';
import type { Size, TableConfig } from './dph.types';

export interface TablePickerFieldConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly label?: string;
  readonly hint?: string;
  /** Full TableConfig — drives column layout, selection mode, etc. */
  readonly tableConfig: TableConfig<T>;
  /** Static rows for the table. Mutually exclusive with a remote `dataSource` (out of scope here). */
  readonly rows: readonly T[];
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-table-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, FieldErrorComponent],
  template: `
    <div class="dph-tp" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-tp__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-tp__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div
        class="dph-tp__panel"
        [attr.id]="inputId()"
        [attr.data-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      >
        <dph-data-table
          [config]="config().tableConfig"
          [data]="rowsArray()"
          [selection]="boundSelection()"
          (selectionChange)="onSelectionChange($any($event))"
        />
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-tp__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './table-picker.component.scss',
})
export class TablePickerComponent<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly config = input.required<TablePickerFieldConfig<T>>();
  /** `unknown` because `idField` values can be string | number depending on the table. */
  readonly value = model<unknown | readonly unknown[] | null>(null);
  readonly blur = output<void>();
  readonly focus = output<void>();

  private readonly _autoId = signal<string>(`dph-tp-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  /** dph-data-table accepts `readonly T[]` directly — no spread needed. */
  protected readonly rowsArray = computed<readonly T[]>(() => this.config().rows);

  /** Index rows by id field for O(1) value↔row mapping. */
  private readonly rowIndex = computed<ReadonlyMap<unknown, T>>(() => {
    const idField = this.config().tableConfig.idField;
    const map = new Map<unknown, T>();
    for (const r of this.config().rows) map.set(r[idField], r);
    return map;
  });

  protected readonly boundSelection = computed<T | T[] | null>(() => {
    const v = this.value();
    const idx = this.rowIndex();
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) {
      return v
        .map((id) => idx.get(id))
        .filter((r): r is T => !!r);
    }
    return idx.get(v) ?? null;
  });

  protected onSelectionChange(sel: T | T[] | null): void {
    if (sel === null || sel === undefined) {
      this.value.set(this.config().tableConfig.selectionMode === 'multiple' ? [] : null);
      return;
    }
    const idField = this.config().tableConfig.idField;
    if (Array.isArray(sel)) {
      this.value.set(sel.map((r) => r[idField]));
      return;
    }
    this.value.set(sel[idField]);
  }
}
