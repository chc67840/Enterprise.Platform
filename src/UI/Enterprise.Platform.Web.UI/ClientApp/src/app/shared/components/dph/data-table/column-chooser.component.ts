/**
 * ─── DPH UI KIT — DATA TABLE — COLUMN CHOOSER ───────────────────────────────────
 *
 * Popover toggle for column visibility. Host owns the visibility map (so it
 * can persist to URL / localStorage). Component just emits (toggle).
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PopoverModule } from 'primeng/popover';

import type { ColumnDef } from '../dph.types';

@Component({
  selector: 'dph-column-chooser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PopoverModule],
  template: `
    <button
      type="button"
      class="dph-cc__trigger"
      aria-label="Choose columns"
      (click)="onTriggerClick($event, pop)"
    >
      <i class="pi pi-eye" aria-hidden="true"></i>
      <span class="dph-cc__count">{{ visibleCount() }}/{{ toggleable().length }}</span>
    </button>

    <p-popover #pop appendTo="body" styleClass="dph-cc__pop">
      <div class="dph-cc">
        <div class="dph-cc__title">Show columns</div>
        <div class="dph-cc__list" role="group" aria-label="Visible columns">
          @for (c of toggleable(); track c.field) {
            <label class="dph-cc__item">
              <input
                type="checkbox"
                [checked]="isVisible(c.field)"
                (change)="onToggle(c.field, $event)"
              />
              <span>{{ c.header }}</span>
            </label>
          }
        </div>
        <div class="dph-cc__actions">
          <button type="button" class="dph-cc__link" (click)="emitAll(true)">All</button>
          <button type="button" class="dph-cc__link" (click)="emitAll(false)">None</button>
          <button type="button" class="dph-cc__link" (click)="reset.emit()">Reset</button>
        </div>
      </div>
    </p-popover>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .dph-cc__trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.625rem;
        border: 1px solid var(--ep-color-neutral-300);
        background: #fff;
        border-radius: var(--ep-radius-md);
        font-size: 0.75rem;
        color: var(--ep-color-neutral-700);
        cursor: pointer;
      }
      .dph-cc__trigger:hover { background: var(--ep-color-neutral-50); }
      .dph-cc__trigger:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-cc__count { font-variant-numeric: tabular-nums; color: var(--ep-color-neutral-500); }

      .dph-cc { display: flex; flex-direction: column; gap: 0.5rem; min-width: 12rem; padding: 0.25rem; }
      .dph-cc__title { font-size: 0.75rem; font-weight: 600; color: var(--ep-color-neutral-700); }
      .dph-cc__list { display: flex; flex-direction: column; max-height: 18rem; overflow: auto; }
      .dph-cc__item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.375rem;
        font-size: 0.8125rem;
        cursor: pointer;
        border-radius: var(--ep-radius-sm);
      }
      .dph-cc__item:hover { background: var(--ep-color-neutral-100); }
      .dph-cc__item input { accent-color: var(--ep-color-primary-700); }
      .dph-cc__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.25rem;
        border-top: 1px solid var(--ep-color-neutral-100);
      }
      .dph-cc__link {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.6875rem;
        color: var(--ep-color-primary-700);
        font-weight: 500;
      }
      .dph-cc__link:hover { text-decoration: underline; }
    `,
  ],
})
export class ColumnChooserComponent {
  readonly columns = input.required<readonly ColumnDef<Record<string, unknown>>[]>();
  readonly visibility = input.required<Record<string, boolean>>();

  readonly toggle = output<{ field: string; visible: boolean }>();
  readonly setAll = output<boolean>();
  readonly reset = output<void>();

  protected readonly toggleable = computed(() =>
    this.columns().filter((c) => c.toggleable !== false && c.type !== 'actions'),
  );

  protected readonly visibleCount = computed(() =>
    this.toggleable().filter((c) => this.isVisible(c.field)).length,
  );

  protected isVisible(field: string): boolean {
    const v = this.visibility()[field];
    return v == null ? true : v;
  }

  protected onToggle(field: string, event: Event): void {
    this.toggle.emit({ field, visible: (event.target as HTMLInputElement).checked });
  }

  protected onTriggerClick(event: Event, pop: { toggle: (e: Event) => void }): void {
    event.stopPropagation();
    pop.toggle(event);
  }

  protected emitAll(visible: boolean): void {
    this.setAll.emit(visible);
  }
}
