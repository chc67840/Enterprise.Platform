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
  styles: [
    `
      :host { display: block; }
      .dph-list { background-color: transparent; }
      .dph-list--scroll { overflow-y: auto; overscroll-behavior: contain; }

      .dph-list__list {
        list-style: none;
        padding: 0;
        margin: 0;
        counter-reset: dph-list-counter;
      }
      .dph-list[data-variant='ordered'] .dph-list__list { list-style: decimal inside; padding-left: 0.5rem; }

      .dph-list__item {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.625rem 0.75rem;
        font-size: 0.875rem;
        color: var(--ep-color-neutral-900);
        min-height: 2.75rem;
      }
      .dph-list--compact .dph-list__item { min-height: 2.25rem; padding: 0.375rem 0.625rem; }
      .dph-list--dividers .dph-list__item + .dph-list__item { border-top: 1px solid var(--ep-color-neutral-200); }
      .dph-list--striped .dph-list__item:nth-child(odd) { background-color: var(--ep-color-neutral-50); }

      .dph-list__item--clickable {
        cursor: pointer;
        touch-action: manipulation;
        transition: background-color 120ms ease;
      }
      .dph-list__item--clickable:hover { background-color: var(--ep-color-primary-50); }
      .dph-list__item--clickable:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: -2px; }
      .dph-list__item--selected { background-color: var(--ep-color-primary-100); color: var(--ep-color-primary-900); }

      .dph-list__item--checked { text-decoration: line-through; color: var(--ep-color-neutral-500); }

      .dph-list__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2.5rem 1rem;
        color: var(--ep-color-neutral-500);
        text-align: center;
      }
      .dph-list__empty i { font-size: 2rem; color: var(--ep-color-neutral-300); }
      .dph-list__empty p { margin: 0; font-size: 0.875rem; }

      .dph-list__default-text { display: block; }

      @media (prefers-reduced-motion: reduce) {
        .dph-list__item--clickable { transition: none; }
      }
    `,
  ],
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
