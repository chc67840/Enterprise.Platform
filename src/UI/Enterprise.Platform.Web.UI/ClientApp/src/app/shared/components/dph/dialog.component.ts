/**
 * ─── DPH UI KIT — DIALOG ────────────────────────────────────────────────────────
 *
 * Wraps PrimeNG <p-dialog> with the safe defaults we always want:
 *   - appendTo="body"        (escape parent overflow + transform context)
 *   - modal=true             (block page interaction)
 *   - closeOnEscape=true     (WCAG 2.1.2 keyboard escape)
 *   - dismissableMask=true   (click backdrop to dismiss)
 *   - max-height clamp       (no overflow past viewport)
 *
 * Slot content:
 *   <dph-dialog ...>
 *     <ng-container slot="content">...form fields...</ng-container>
 *     <ng-container slot="footer">...action buttons...</ng-container>
 *   </dph-dialog>
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';

import type { DialogConfig } from './dph.types';

@Component({
  selector: 'dph-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [header]="config().header || ''"
      [modal]="config().modal ?? true"
      [closable]="config().closable ?? true"
      [dismissableMask]="config().dismissableMask ?? true"
      [closeOnEscape]="config().closeOnEscape ?? true"
      [draggable]="config().draggable ?? false"
      [resizable]="config().resizable ?? false"
      [maximizable]="config().maximizable ?? false"
      [position]="config().position || 'center'"
      [style]="dialogStyle()"
      [contentStyle]="contentStyle()"
      appendTo="body"
      styleClass="dph-dialog"
      (onHide)="onHide()"
    >
      @if (config().subheader; as sub) {
        <ng-template pTemplate="headline">
          <p class="dph-dialog__subheader">{{ sub }}</p>
        </ng-template>
      }

      <div class="dph-dialog__body">
        @if (config().loading) {
          <div class="dph-dialog__loading" role="status" aria-live="polite">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            <span>Loading…</span>
          </div>
        }
        <ng-content select="[slot=content]" />
        <ng-content />
      </div>

      <ng-template pTemplate="footer">
        <div class="dph-dialog__footer" [attr.data-align]="config().footerAlign || 'right'">
          <ng-content select="[slot=footer]" />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styleUrl: './dialog.component.scss',
})
export class DialogComponent {
  readonly config = input.required<DialogConfig>();
  readonly visible = model<boolean>(false);

  readonly closed = output<void>();

  protected readonly dialogStyle = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    out['width'] = this.config().width || 'min(520px, 92vw)';
    out['maxHeight'] = this.config().maxHeight || 'calc(100dvh - 4rem)';
    return out;
  });

  protected readonly contentStyle = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    out['padding'] = '0';
    out['overflow'] = 'hidden';
    return out;
  });

  protected onHide(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
