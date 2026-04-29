/**
 * ─── DPH UI KIT — DRAWER ────────────────────────────────────────────────────────
 *
 * Side-anchored slide-in panel. Wraps PrimeNG Drawer (formerly Sidebar).
 * Defaults: appendTo body, dismissable mask, escape closes, 320px wide
 * with max 85vw fallback for narrow viewports.
 *
 *   <dph-drawer
 *     [(visible)]="filterPanelOpen"
 *     [config]="{ position: 'right', header: 'Filters', width: 'min(360px, 90vw)' }">
 *     ...filter form content...
 *   </dph-drawer>
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

import type { DrawerConfig } from './dph.types';

@Component({
  selector: 'dph-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DrawerModule],
  template: `
    <p-drawer
      [(visible)]="visible"
      [position]="config().position"
      [modal]="config().modal ?? true"
      [dismissible]="config().dismissableMask ?? true"
      [closeOnEscape]="config().closeOnEscape ?? true"
      [showCloseIcon]="config().closable ?? true"
      [header]="config().header || ''"
      appendTo="body"
      [style]="drawerStyle()"
      styleClass="dph-drawer"
      (onHide)="onHide()"
    >
      <ng-content />
    </p-drawer>
  `,
  styleUrl: './drawer.component.scss',
})
export class DrawerComponent {
  readonly config = input.required<DrawerConfig>();
  readonly visible = model<boolean>(false);
  readonly closed = output<void>();

  protected readonly drawerStyle = computed<Record<string, string>>(() => {
    const c = this.config();
    const horizontal = c.position === 'left' || c.position === 'right';
    const out: Record<string, string> = {};
    if (horizontal) {
      out['width'] = c.width || 'min(320px, 85vw)';
    } else {
      out['height'] = c.height || 'min(360px, 70vh)';
    }
    return out;
  });

  protected onHide(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
