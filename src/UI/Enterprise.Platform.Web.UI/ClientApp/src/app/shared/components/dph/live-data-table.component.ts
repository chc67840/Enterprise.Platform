/**
 * ─── DPH UI KIT — LIVE DATA TABLE (RAW-SIGNALS ALTERNATIVE) ─────────────────────
 *
 * For real-time / streaming data scenarios where the main DataTable's
 * PrimeNG layer becomes a liability:
 *   - Web-socket / SSE row append with new-row highlight
 *   - 60fps virtual scroll on 100k+ rows
 *   - Pure signal reactivity — no internal table state to fight
 *   - Lighter bundle (no <p-table> dep)
 *
 * Trade-off vs main DataTable: less out-of-the-box (no PrimeNG selection,
 * frozen columns, paginator). Use when you need raw speed and full control.
 *
 *   <dph-live-data-table
 *     [columns]="cols"
 *     [rows]="rows()"
 *     [rowHeight]="44"
 *     [highlightNew]="true"
 *     (rowClick)="open($event)"
 *   />
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  type ElementRef,
} from '@angular/core';

import { CellRendererComponent } from './data-table/cell-renderer.component';
import type { ColumnDef } from './dph.types';

interface ViewportRow<T> {
  readonly index: number;
  readonly data: T;
  readonly isNew: boolean;
}

@Component({
  selector: 'dph-live-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CellRendererComponent],
  template: `
    <div class="dph-live" [style.height]="height()">
      <div class="dph-live__header" role="row">
        @for (col of columns(); track col.field) {
          <div
            class="dph-live__th"
            role="columnheader"
            [style.width]="col.width || '1fr'"
            [style.text-align]="col.align || 'left'"
            (click)="onHeaderClick(col.field)"
          >
            {{ col.header }}
            @if (sortField() === col.field) {
              <i class="pi" [class.pi-sort-amount-down]="sortDir() === 'desc'" [class.pi-sort-amount-up-alt]="sortDir() === 'asc'" aria-hidden="true"></i>
            }
          </div>
        }
      </div>

      <div #viewport class="dph-live__viewport" (scroll)="onScroll()" tabindex="0" role="rowgroup">
        <div class="dph-live__spacer" [style.height]="totalHeight() + 'px'">
          <div class="dph-live__rows" [style.transform]="'translateY(' + offsetY() + 'px)'">
            @for (vr of viewportRows(); track vr.index) {
              <div
                class="dph-live__row"
                [class.dph-live__row--new]="vr.isNew"
                role="row"
                [style.height]="rowHeight() + 'px'"
                (click)="rowClick.emit({ row: vr.data, index: vr.index })"
              >
                @for (col of columns(); track col.field) {
                  <div
                    class="dph-live__td"
                    role="cell"
                    [style.width]="col.width || '1fr'"
                    [style.text-align]="col.align || 'left'"
                  >
                    <dph-cell
                      [type]="col.type || 'text'"
                      [value]="getValue(vr.data, col.field)"
                      [column]="$any(col)"
                      [row]="$any(vr.data)"
                    />
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <div class="dph-live__footer">
        <span>{{ sortedRows().length | number }} rows</span>
        @if (newCount() > 0) {
          <button type="button" class="dph-live__new" (click)="acknowledgeNew()" aria-live="polite">
            <i class="pi pi-arrow-down" aria-hidden="true"></i>
            {{ newCount() }} new — scroll to top
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './live-data-table.component.scss',
})
export class LiveDataTableComponent<T extends Record<string, unknown>> {
  readonly columns = input.required<readonly ColumnDef<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly idField = input<string>('id');
  readonly rowHeight = input<number>(44);
  readonly height = input<string>('400px');
  readonly highlightNew = input<boolean>(true);
  readonly overscan = input<number>(5);

  readonly rowClick = output<{ row: T; index: number }>();

  @ViewChild('viewport', { static: true }) protected viewportEl!: ElementRef<HTMLDivElement>;

  protected readonly scrollTop = signal<number>(0);
  protected readonly viewportHeight = signal<number>(400);
  protected readonly sortField = signal<string>('');
  protected readonly sortDir = signal<'asc' | 'desc' | null>(null);
  protected readonly seenIds = signal<Set<unknown>>(new Set());
  protected readonly newCount = signal<number>(0);

  protected readonly sortedRows = computed<readonly T[]>(() => {
    const rows = this.rows();
    const f = this.sortField();
    const d = this.sortDir();
    if (!f || !d) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const av = this.getValue(a, f);
      const bv = this.getValue(b, f);
      const cmp =
        av == null ? -1 :
        bv == null ? 1 :
        typeof av === 'number' && typeof bv === 'number' ? av - bv :
        String(av).localeCompare(String(bv), undefined, { numeric: true });
      return d === 'asc' ? cmp : -cmp;
    });
    return sorted;
  });

  protected readonly totalHeight = computed<number>(() => this.sortedRows().length * this.rowHeight());

  protected readonly viewportRows = computed<readonly ViewportRow<T>[]>(() => {
    const rows = this.sortedRows();
    const rh = this.rowHeight();
    const top = this.scrollTop();
    const vh = this.viewportHeight();
    const start = Math.max(0, Math.floor(top / rh) - this.overscan());
    const end = Math.min(rows.length, Math.ceil((top + vh) / rh) + this.overscan());
    const seen = this.seenIds();
    const out: ViewportRow<T>[] = [];
    for (let i = start; i < end; i++) {
      const r = rows[i]!;
      const id = this.getValue(r, this.idField());
      out.push({ index: i, data: r, isNew: this.highlightNew() && !seen.has(id) });
    }
    return out;
  });

  protected readonly offsetY = computed<number>(() => {
    const start = Math.max(0, Math.floor(this.scrollTop() / this.rowHeight()) - this.overscan());
    return start * this.rowHeight();
  });

  constructor() {
    // Track newly-arrived rows. CRITICAL: read seenIds inside untracked() so
    // the write below doesn't retrigger this effect (infinite loop). Only
    // `rows` and `idField` are real dependencies.
    effect(() => {
      const rows = this.rows();
      const idF = this.idField();
      untracked(() => {
        const cur = this.seenIds();
        let added = 0;
        const next = new Set(cur);
        for (const r of rows) {
          const id = this.getValue(r, idF);
          if (!cur.has(id)) {
            next.add(id);
            added++;
          }
        }
        if (added > 0) {
          if (cur.size > 0) this.newCount.update((n) => n + added);
          this.seenIds.set(next);
        }
      });
    });
  }

  protected onScroll(): void {
    const el = this.viewportEl.nativeElement;
    this.scrollTop.set(el.scrollTop);
    this.viewportHeight.set(el.clientHeight);
  }

  protected onHeaderClick(field: string): void {
    if (this.sortField() !== field) {
      this.sortField.set(field);
      this.sortDir.set('asc');
      return;
    }
    if (this.sortDir() === 'asc') this.sortDir.set('desc');
    else if (this.sortDir() === 'desc') {
      this.sortField.set('');
      this.sortDir.set(null);
    } else this.sortDir.set('asc');
  }

  protected acknowledgeNew(): void {
    this.viewportEl.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
    this.newCount.set(0);
  }

  protected getValue(row: T, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, p) => {
      if (acc && typeof acc === 'object' && p in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[p];
      }
      return undefined;
    }, row);
  }
}
