/**
 * ─── DPH UI KIT — CONTEXT MENU ──────────────────────────────────────────────────
 *
 * Right-click context menu. Wraps PrimeNG ContextMenu. Use either:
 *   - global: true   → attaches to document (right-click anywhere triggers)
 *   - global: false  → attaches to projected content (right-click on the
 *                       wrapped element triggers)
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
} from '@angular/core';
import { Router } from '@angular/router';
import { ContextMenuModule } from 'primeng/contextmenu';
import type { MenuItem as PrimeMenuItem } from 'primeng/api';

import type { ContextMenuConfig, MenuItem } from './dph.types';

@Component({
  selector: 'dph-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ContextMenuModule],
  template: `
    <div #wrap class="dph-ctx__wrap">
      <ng-content />
    </div>

    <p-contextMenu
      [model]="primeItems()"
      [target]="config().global ? null : wrap"
      [global]="!!config().global"
      appendTo="body"
      styleClass="dph-context-menu"
    />
  `,
  styles: [
    `
      :host { display: contents; }
      .dph-ctx__wrap { display: contents; }
    `,
  ],
})
export class ContextMenuComponent {
  readonly config = input.required<ContextMenuConfig>();

  @ViewChild('wrap') wrap!: ElementRef<HTMLElement>;

  private readonly router = inject(Router);

  protected readonly primeItems = computed<PrimeMenuItem[]>(() =>
    this.toPrime(this.config().items),
  );

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
            ? () => void this.router.navigate([i.routePath!])
            : undefined,
        items: i.items?.length ? this.toPrime(i.items) : undefined,
      } satisfies PrimeMenuItem;
    });
  }
}
