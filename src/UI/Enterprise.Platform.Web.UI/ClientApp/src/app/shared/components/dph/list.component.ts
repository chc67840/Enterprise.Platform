/**
 * ─── DPH UI KIT — LIST ──────────────────────────────────────────────────────────
 *
 * Versatile list — simple/ordered/data/selectable/checklist variants.
 * For draggable lists, layer Angular CDK DragDropModule on top via the
 * `draggable` variant (delegates to the host's drop handler).
 *
 *   <dph-list
 *     [config]="{ variant: 'data', dividers: true }"
 *     [items]="users()"
 *     [itemTemplate]="rowTpl"
 *   />
 *
 *   <ng-template #rowTpl let-u let-i="index" let-selected="selected">
 *     <div class="flex items-center gap-3">
 *       <dph-avatar [config]="{ name: u.firstName + ' ' + u.lastName, size: 'sm' }" />
 *       <span>{{ u.firstName }} {{ u.lastName }}</span>
 *     </div>
 *   </ng-template>
 */
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

import type { ListConfig } from './dph.types';

@Component({
  selector: 'dph-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, CheckboxModule],
  template: `
    <div
      class="dph-list"
      [attr.data-variant]="config().variant"
      [class.dph-list--dividers]="!!config().dividers"
      [class.dph-list--striped]="!!config().striped"
      [class.dph-list--compact]="!!config().compact"
      [style.maxHeight]="config().maxHeight || null"
      [class.dph-list--scroll]="!!config().maxHeight"
    >
      @if (items().length === 0) {
        <div class="dph-list__empty" role="status">
          <i class="pi pi-list" aria-hidden="true"></i>
          <p>{{ config().emptyMessage || 'No items.' }}</p>
        </div>
      } @else {
        @switch (config().variant) {
          @case ('ordered') {
            <ol class="dph-list__list" role="list">
              @for (item of items(); track $index) {
                <li class="dph-list__item">
                  <ng-container [ngTemplateOutlet]="config().itemTemplate || defaultTpl" [ngTemplateOutletContext]="{ $implicit: item, index: $index, selected: false }" />
                </li>
              }
            </ol>
          }
          @case ('selectable') {
            <ul class="dph-list__list" role="listbox" [attr.aria-multiselectable]="config().selectionMode === 'multiple'">
              @for (item of items(); track $index) {
                <li
                  class="dph-list__item dph-list__item--clickable"
                  role="option"
                  [attr.aria-selected]="isSelected(item)"
                  [class.dph-list__item--selected]="isSelected(item)"
                  (click)="toggleSelect(item)"
                  (keydown.enter)="toggleSelect(item)"
                  (keydown.space)="toggleSelect(item); $event.preventDefault()"
                  tabindex="0"
                >
                  <ng-container [ngTemplateOutlet]="config().itemTemplate || defaultTpl" [ngTemplateOutletContext]="{ $implicit: item, index: $index, selected: isSelected(item) }" />
                </li>
              }
            </ul>
          }
          @case ('checklist') {
            <ul class="dph-list__list" role="list">
              @for (item of items(); track $index) {
                <li class="dph-list__item dph-list__item--clickable" (click)="toggleSelect(item)">
                  <p-checkbox [binary]="true" [ngModel]="isSelected(item)" [inputId]="'dph-cl-' + $index" />
                  <span [class.dph-list__item--checked]="isSelected(item)">
                    <ng-container [ngTemplateOutlet]="config().itemTemplate || defaultTpl" [ngTemplateOutletContext]="{ $implicit: item, index: $index, selected: isSelected(item) }" />
                  </span>
                </li>
              }
            </ul>
          }
          @default {
            <ul class="dph-list__list" role="list">
              @for (item of items(); track $index) {
                <li class="dph-list__item" (click)="emitClick(item, $index)">
                  <ng-container [ngTemplateOutlet]="config().itemTemplate || defaultTpl" [ngTemplateOutletContext]="{ $implicit: item, index: $index, selected: false }" />
                </li>
              }
            </ul>
          }
        }
      }
    </div>

    <ng-template #defaultTpl let-item>
      <span class="dph-list__default-text">{{ asText(item) }}</span>
    </ng-template>
  `,
  styleUrl: './list.component.scss',
})
export class ListComponent<T = unknown> {
  readonly config = input.required<ListConfig<T>>();
  readonly items = input<readonly T[]>([]);
  readonly selectedItems = model<readonly T[]>([]);

  readonly itemClick = output<{ item: T; index: number }>();
  readonly selectionChange = output<readonly T[]>();

  protected isSelected(item: T): boolean {
    return this.selectedItems().includes(item);
  }

  protected toggleSelect(item: T): void {
    const sel = this.selectedItems();
    const next: readonly T[] =
      this.config().selectionMode === 'single'
        ? this.isSelected(item) ? [] : [item]
        : this.isSelected(item) ? sel.filter((x) => x !== item) : [...sel, item];
    this.selectedItems.set(next);
    this.selectionChange.emit(next);
  }

  protected emitClick(item: T, index: number): void {
    this.itemClick.emit({ item, index });
  }

  protected asText(item: T): string {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    if (typeof item === 'object' && 'label' in (item as Record<string, unknown>)) {
      return String((item as Record<string, unknown>)['label']);
    }
    return JSON.stringify(item);
  }
}
