/**
 * ─── DPH UI KIT — POPOVER ───────────────────────────────────────────────────────
 *
 * Click-triggered popover panel. Wraps PrimeNG Popover with appendTo body
 * + stopPropagation on trigger.
 *
 *   <dph-popover>
 *     <dph-button slot="trigger" label="Filters" icon="pi pi-filter" />
 *     <ng-container slot="content">
 *       <h4>Active filters</h4>
 *       ...
 *     </ng-container>
 *   </dph-popover>
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild, input, signal } from '@angular/core';
import { type Popover, PopoverModule } from 'primeng/popover';

import type { PopoverConfig } from './dph.types';

@Component({
  selector: 'dph-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PopoverModule],
  template: `
    <span class="dph-pop__trigger" (click)="onTriggerClick($event)">
      <ng-content select="[slot=trigger]" />
    </span>
    <p-popover
      #pop
      appendTo="body"
      [styleClass]="'dph-popover'"
      [style]="popStyle()"
      [dismissable]="config()?.dismissable ?? true"
      (onShow)="isOpen.set(true)"
      (onHide)="isOpen.set(false)"
    >
      <ng-content select="[slot=content]" />
      <ng-content />
    </p-popover>
  `,
  styleUrl: './popover.component.scss',
})
export class PopoverComponent {
  readonly config = input<PopoverConfig | undefined>(undefined);
  @ViewChild('pop') pop!: Popover;
  protected readonly isOpen = signal<boolean>(false);

  protected popStyle(): Record<string, string> {
    const out: Record<string, string> = {};
    const max = this.config()?.maxWidth;
    if (max) out['maxWidth'] = max;
    return out;
  }

  protected onTriggerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.pop.toggle(event);
  }
}
