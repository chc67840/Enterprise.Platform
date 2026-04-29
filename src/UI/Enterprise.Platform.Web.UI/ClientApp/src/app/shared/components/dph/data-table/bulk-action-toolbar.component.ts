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
  styleUrl: './bulk-action-toolbar.component.scss',
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
