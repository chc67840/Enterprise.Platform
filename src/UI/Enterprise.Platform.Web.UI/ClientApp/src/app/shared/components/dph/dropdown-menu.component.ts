/**
 * ─── DPH UI KIT — DROPDOWN MENU ─────────────────────────────────────────────────
 *
 * Click-triggered popup menu. Wraps PrimeNG Menu (popup mode) with our
 * standard appendTo body + stopPropagation on the trigger. The trigger
 * is provided via projected content with a `[dphDropdownTrigger]` element
 * (any clickable element) — clicking the trigger toggles the popup.
 *
 *   <dph-dropdown-menu [config]="{ items: actions }">
 *     <dph-button variant="ghost" icon="pi pi-ellipsis-v" ariaLabel="Actions" />
 *   </dph-dropdown-menu>
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { type Menu, MenuModule } from 'primeng/menu';
import type { MenuItem as PrimeMenuItem } from 'primeng/api';

import type { DropdownMenuConfig, MenuItem } from './dph.types';

@Component({
  selector: 'dph-dropdown-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MenuModule],
  template: `
    <span
      #triggerWrap
      class="dph-dropdown__trigger-wrap"
      (click)="onTriggerClick($event)"
    >
      <ng-content />
    </span>

    <p-menu
      #menu
      [model]="primeItems()"
      [popup]="true"
      appendTo="body"
      styleClass="dph-dropdown-menu"
      (onShow)="isOpen.set(true)"
      (onHide)="isOpen.set(false)"
    />
  `,
  styleUrl: './dropdown-menu.component.scss',
})
export class DropdownMenuComponent {
  readonly config = input.required<DropdownMenuConfig>();

  @ViewChild('menu') menu!: Menu;
  @ViewChild('triggerWrap') triggerWrap!: ElementRef<HTMLElement>;

  protected readonly isOpen = signal<boolean>(false);

  private readonly router = inject(Router);

  /** Convert dph MenuItem[] → PrimeNG MenuItem[]. */
  protected readonly primeItems = computed<PrimeMenuItem[]>(() =>
    this.toPrime(this.config().items),
  );

  protected onTriggerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.menu.toggle(event);
  }

  private toPrime(items: readonly MenuItem[]): PrimeMenuItem[] {
    return items.filter((i) => i.visible !== false).map((i) => {
      if (i.separator) return { separator: true };
      return {
        label: i.label,
        icon: i.icon,
        disabled: i.disabled,
        command: i.command
          ? () => i.command!()
          : i.routePath
            ? () => void this.router.navigate([i.routePath!], i.queryParams ? { queryParams: i.queryParams } : undefined)
            : i.externalUrl
              ? () => window.open(i.externalUrl!, '_blank', 'noopener,noreferrer')
              : undefined,
        items: i.items?.length ? this.toPrime(i.items) : undefined,
      } satisfies PrimeMenuItem;
    });
  }
}
