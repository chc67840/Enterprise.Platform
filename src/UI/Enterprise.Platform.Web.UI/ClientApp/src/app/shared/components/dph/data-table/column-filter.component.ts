/**
 * ─── DPH UI KIT — DATA TABLE — COLUMN FILTER ────────────────────────────────────
 *
 * Per-column header filter popover. One component covers all FilterType values:
 *   text | number | date | boolean | enum | multi-enum | range
 *
 * Hosts emit a (filterChange) of FilterValue|null. The DataTable pipes that
 * into its TableQuery and re-runs the DataSource (or re-filters in-memory).
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopoverModule } from 'primeng/popover';

import type { FilterDef, FilterOp, FilterValue, OptionItem } from '../dph.types';

interface OpChoice {
  readonly op: FilterOp;
  readonly label: string;
}

const OPS_BY_TYPE: Record<string, readonly OpChoice[]> = {
  text: [
    { op: 'contains', label: 'Contains' },
    { op: 'notContains', label: 'Does not contain' },
    { op: 'equals', label: 'Equals' },
    { op: 'notEquals', label: 'Not equal' },
    { op: 'startsWith', label: 'Starts with' },
    { op: 'endsWith', label: 'Ends with' },
    { op: 'isEmpty', label: 'Is empty' },
    { op: 'isNotEmpty', label: 'Is not empty' },
  ],
  number: [
    { op: 'equals', label: '=' },
    { op: 'notEquals', label: '≠' },
    { op: 'lt', label: '<' },
    { op: 'lte', label: '≤' },
    { op: 'gt', label: '>' },
    { op: 'gte', label: '≥' },
    { op: 'between', label: 'Between' },
  ],
  date: [
    { op: 'on', label: 'On' },
    { op: 'before', label: 'Before' },
    { op: 'after', label: 'After' },
    { op: 'dateRange', label: 'Range' },
    { op: 'inLast', label: 'In last (days)' },
  ],
  boolean: [
    { op: 'is', label: 'Is' },
  ],
  enum: [
    { op: 'equals', label: 'Is' },
    { op: 'notEquals', label: 'Is not' },
  ],
  'multi-enum': [
    { op: 'in', label: 'Is one of' },
    { op: 'notIn', label: 'Is not one of' },
  ],
  range: [{ op: 'between', label: 'Between' }],
};

@Component({
  selector: 'dph-column-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PopoverModule],
  template: `
    <button
      type="button"
      class="dph-cf__btn"
      [class.dph-cf__btn--active]="!!current()"
      [attr.aria-label]="'Filter ' + (label() || 'column')"
      (click)="onTriggerClick($event, pop)"
    >
      <i class="pi pi-filter" aria-hidden="true"></i>
      @if (current()) {
        <span class="dph-cf__dot" aria-hidden="true"></span>
      }
    </button>

    <p-popover #pop appendTo="body" [dismissable]="true" styleClass="dph-cf__pop">
      <div class="dph-cf">
        <div class="dph-cf__title">
          {{ label() || 'Filter' }}
        </div>

        <select class="dph-cf__op" [(ngModel)]="opModel">
          @for (oc of opChoices(); track oc.op) {
            <option [value]="oc.op">{{ oc.label }}</option>
          }
        </select>

        @switch (def().type) {
          @case ('text') {
            @if (opModel !== 'isEmpty' && opModel !== 'isNotEmpty') {
              <input
                type="text"
                class="dph-cf__input"
                [placeholder]="def().placeholder || 'Filter…'"
                [(ngModel)]="textValue"
                (keydown.enter)="apply(); pop.hide()"
              />
            }
          }
          @case ('number') {
            <input
              type="number"
              class="dph-cf__input"
              [placeholder]="def().placeholder || 'Value'"
              [(ngModel)]="numberValue"
              (keydown.enter)="apply(); pop.hide()"
            />
            @if (opModel === 'between') {
              <input
                type="number"
                class="dph-cf__input"
                placeholder="and"
                [(ngModel)]="numberValue2"
                (keydown.enter)="apply(); pop.hide()"
              />
            }
          }
          @case ('range') {
            <input
              type="number"
              class="dph-cf__input"
              placeholder="min"
              [(ngModel)]="numberValue"
            />
            <input
              type="number"
              class="dph-cf__input"
              placeholder="max"
              [(ngModel)]="numberValue2"
            />
          }
          @case ('date') {
            @if (opModel === 'inLast') {
              <input
                type="number"
                class="dph-cf__input"
                placeholder="days"
                [(ngModel)]="numberValue"
              />
            } @else {
              <input
                type="date"
                class="dph-cf__input"
                [(ngModel)]="dateValue"
              />
              @if (opModel === 'dateRange') {
                <input
                  type="date"
                  class="dph-cf__input"
                  [(ngModel)]="dateValue2"
                />
              }
            }
          }
          @case ('boolean') {
            <select class="dph-cf__input" [(ngModel)]="boolValue">
              <option [ngValue]="true">True</option>
              <option [ngValue]="false">False</option>
            </select>
          }
          @case ('enum') {
            <select class="dph-cf__input" [(ngModel)]="enumValue">
              <option [ngValue]="null">— Any —</option>
              @for (opt of def().options || []; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          }
          @case ('multi-enum') {
            <div class="dph-cf__chips" role="group" [attr.aria-label]="(label() || 'Filter') + ' values'">
              @for (opt of def().options || []; track opt.value) {
                <label class="dph-cf__chip">
                  <input
                    type="checkbox"
                    [checked]="multiValue.includes(opt.value)"
                    (change)="toggleMulti(opt, $event)"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              }
            </div>
          }
        }

        <div class="dph-cf__actions">
          <button type="button" class="dph-cf__link" (click)="clear(); pop.hide()">Clear</button>
          <button type="button" class="dph-cf__primary" (click)="apply(); pop.hide()">Apply</button>
        </div>
      </div>
    </p-popover>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .dph-cf__btn {
        display: inline-grid;
        place-items: center;
        position: relative;
        width: 1.75rem;
        height: 1.75rem;
        border: none;
        background: transparent;
        border-radius: var(--ep-radius-sm);
        color: var(--ep-color-neutral-500);
        cursor: pointer;
      }
      .dph-cf__btn:hover { background-color: var(--ep-color-neutral-100); color: var(--ep-color-neutral-800); }
      .dph-cf__btn--active { color: var(--ep-color-primary-700); }
      .dph-cf__btn:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-cf__dot {
        position: absolute;
        top: 0.125rem;
        right: 0.125rem;
        width: 0.375rem;
        height: 0.375rem;
        border-radius: 9999px;
        background-color: var(--ep-color-jessamine-500);
      }

      .dph-cf {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 14rem;
        padding: 0.25rem;
      }
      .dph-cf__title {
        font-weight: 600;
        font-size: 0.8125rem;
        color: var(--ep-color-neutral-900);
      }
      .dph-cf__op,
      .dph-cf__input {
        width: 100%;
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--ep-color-neutral-300);
        border-radius: var(--ep-radius-md);
        font-size: 0.8125rem;
        background: #fff;
        color: var(--ep-color-neutral-900);
      }
      .dph-cf__op:focus,
      .dph-cf__input:focus {
        outline: none;
        border-color: var(--ep-color-primary-500);
        box-shadow: 0 0 0 3px var(--ep-color-primary-100);
      }
      .dph-cf__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        max-height: 12rem;
        overflow: auto;
      }
      .dph-cf__chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
        border: 1px solid var(--ep-color-neutral-200);
        border-radius: 9999px;
        cursor: pointer;
        background: var(--ep-color-neutral-50);
      }
      .dph-cf__chip input { accent-color: var(--ep-color-primary-700); }
      .dph-cf__chip:has(input:checked) {
        background: var(--ep-color-primary-50);
        border-color: var(--ep-color-primary-300);
        color: var(--ep-color-primary-800);
      }
      .dph-cf__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.25rem;
        border-top: 1px solid var(--ep-color-neutral-100);
      }
      .dph-cf__link {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
      }
      .dph-cf__primary {
        background: var(--ep-color-primary-700);
        color: #fff;
        border: none;
        border-radius: var(--ep-radius-md);
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .dph-cf__primary:hover { background: var(--ep-color-primary-800); }
      :host ::ng-deep .dph-cf__pop .p-popover-content { padding: 0.5rem; }
    `,
  ],
})
export class ColumnFilterComponent {
  readonly def = input.required<FilterDef>();
  readonly value = input<FilterValue | null>(null);
  readonly label = input<string>('');

  readonly filterChange = output<FilterValue | null>();

  protected readonly current = computed<FilterValue | null>(() => this.value());

  protected opModel: FilterOp = 'contains';
  protected textValue = '';
  protected numberValue: number | null = null;
  protected numberValue2: number | null = null;
  protected dateValue = '';
  protected dateValue2 = '';
  protected boolValue: boolean | null = null;
  protected enumValue: unknown = null;
  protected multiValue: unknown[] = [];

  protected readonly opChoices = computed<readonly OpChoice[]>(() => {
    const all = OPS_BY_TYPE[this.def().type] ?? [];
    const allowed = this.def().ops;
    if (!allowed?.length) return all;
    return all.filter((c) => allowed.includes(c.op));
  });

  constructor() {
    effect(() => {
      const v = this.value();
      const def = this.def();
      const fallback = def.defaultOp ?? this.opChoices()[0]?.op ?? 'contains';
      this.opModel = (v?.op as FilterOp) ?? fallback;
      this.applyValueToInputs(v);
    });
  }

  private applyValueToInputs(v: FilterValue | null): void {
    if (!v) {
      this.textValue = '';
      this.numberValue = null;
      this.numberValue2 = null;
      this.dateValue = '';
      this.dateValue2 = '';
      this.boolValue = null;
      this.enumValue = null;
      this.multiValue = [];
      return;
    }
    const t = this.def().type;
    if (t === 'text') this.textValue = String(v.value ?? '');
    if (t === 'number' || t === 'range') {
      this.numberValue = v.value as number | null;
      this.numberValue2 = (v.value2 as number | null) ?? null;
    }
    if (t === 'date') {
      if (v.op === 'inLast') this.numberValue = v.value as number | null;
      else {
        this.dateValue = (v.value as string) ?? '';
        this.dateValue2 = (v.value2 as string) ?? '';
      }
    }
    if (t === 'boolean') this.boolValue = v.value as boolean | null;
    if (t === 'enum') this.enumValue = v.value;
    if (t === 'multi-enum') this.multiValue = Array.isArray(v.value) ? [...v.value] : [];
  }

  protected onTriggerClick(event: Event, pop: { toggle: (e: Event) => void }): void {
    event.stopPropagation();
    pop.toggle(event);
  }

  protected toggleMulti(opt: OptionItem, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.multiValue = [...this.multiValue, opt.value];
    else this.multiValue = this.multiValue.filter((v) => v !== opt.value);
  }

  protected apply(): void {
    const t = this.def().type;
    let value: unknown = null;
    let value2: unknown;
    if (t === 'text') {
      if (this.opModel === 'isEmpty' || this.opModel === 'isNotEmpty') value = true;
      else value = this.textValue;
    } else if (t === 'number' || t === 'range') {
      value = this.numberValue;
      value2 = this.numberValue2;
    } else if (t === 'date') {
      if (this.opModel === 'inLast') value = this.numberValue;
      else {
        value = this.dateValue;
        value2 = this.dateValue2;
      }
    } else if (t === 'boolean') value = this.boolValue;
    else if (t === 'enum') value = this.enumValue;
    else if (t === 'multi-enum') value = this.multiValue;

    if (value === '' || value == null || (Array.isArray(value) && value.length === 0)) {
      this.filterChange.emit(null);
      return;
    }
    const fv: FilterValue = value2 !== undefined ? { op: this.opModel, value, value2 } : { op: this.opModel, value };
    this.filterChange.emit(fv);
  }

  protected clear(): void {
    this.applyValueToInputs(null);
    this.filterChange.emit(null);
  }
}
