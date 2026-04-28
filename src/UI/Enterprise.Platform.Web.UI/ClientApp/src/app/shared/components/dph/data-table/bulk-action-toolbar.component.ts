/**
 * ─── DPH UI KIT — DATA TABLE — BULK ACTION TOOLBAR ──────────────────────────────
 *
 * Slides in above the table when N>0 rows are selected. Hosts can show:
 *   - selected count
 *   - bulk action buttons (configured on TableConfig.bulkActions)
 *   - clear-selection action
 *   - select-all-matching-filter action (when server-mode + filtered)
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { BulkAction } from '../dph.types';

@Component({
  selector: 'dph-bulk-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (count() > 0) {
      <div class="dph-bulk" role="region" aria-live="polite" aria-label="Bulk actions">
        <div class="dph-bulk__left">
          <span class="dph-bulk__count">{{ count() }}</span>
          <span class="dph-bulk__label">selected</span>
          @if (showSelectAll() && totalMatching() > count()) {
            <button type="button" class="dph-bulk__link" (click)="selectAll.emit()">
              Select all {{ totalMatching() }} matching
            </button>
          }
          @if (count() > 0) {
            <button type="button" class="dph-bulk__link" (click)="clear.emit()">Clear</button>
          }
        </div>

        <div class="dph-bulk__right">
          @for (act of actions(); track act.key) {
            <button
              type="button"
              class="dph-bulk__btn"
              [attr.data-severity]="act.severity || 'neutral'"
              (click)="onAction(act)"
            >
              <i [class]="act.icon" aria-hidden="true"></i>
              <span>{{ act.label }}</span>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .dph-bulk {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        background: var(--ep-color-primary-50);
        border: 1px solid var(--ep-color-primary-200);
        border-radius: var(--ep-radius-md);
        margin-bottom: 0.5rem;
        animation: dph-bulk-in 180ms ease-out;
      }
      @keyframes dph-bulk-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) { .dph-bulk { animation: none; } }

      .dph-bulk__left,
      .dph-bulk__right {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .dph-bulk__count {
        display: inline-grid;
        place-items: center;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.375rem;
        background: var(--ep-color-primary-700);
        color: #fff;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .dph-bulk__label { font-size: 0.8125rem; color: var(--ep-color-primary-900); font-weight: 500; }
      .dph-bulk__link {
        background: transparent;
        border: none;
        color: var(--ep-color-primary-800);
        font-size: 0.75rem;
        cursor: pointer;
        text-decoration: underline;
      }
      .dph-bulk__link:hover { color: var(--ep-color-primary-900); }
      .dph-bulk__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        border: 1px solid var(--ep-color-neutral-300);
        background: #fff;
        border-radius: var(--ep-radius-md);
        font-size: 0.75rem;
        color: var(--ep-color-neutral-800);
        cursor: pointer;
      }
      .dph-bulk__btn:hover { background: var(--ep-color-neutral-50); border-color: var(--ep-color-neutral-400); }
      .dph-bulk__btn:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-bulk__btn[data-severity='danger'] { color: var(--ep-color-danger-600); border-color: var(--ep-color-danger-100); }
      .dph-bulk__btn[data-severity='danger']:hover { background: var(--ep-color-danger-50); }
      .dph-bulk__btn[data-severity='success'] { color: var(--ep-color-palmetto-700); border-color: var(--ep-color-palmetto-200); }
      .dph-bulk__btn[data-severity='warning'] { color: var(--ep-color-jessamine-800); border-color: var(--ep-color-jessamine-200); }
    `,
  ],
})
export class BulkToolbarComponent {
  readonly count = input<number>(0);
  readonly totalMatching = input<number>(0);
  readonly actions = input<readonly BulkAction[]>([]);
  readonly showSelectAll = input<boolean>(false);

  readonly action = output<BulkAction>();
  readonly clear = output<void>();
  readonly selectAll = output<void>();

  protected onAction(act: BulkAction): void {
    if (act.confirm) {
      const ok = window.confirm(act.confirmMessage || `${act.label}? (${this.count()} rows)`);
      if (!ok) return;
    }
    this.action.emit(act);
  }
}
