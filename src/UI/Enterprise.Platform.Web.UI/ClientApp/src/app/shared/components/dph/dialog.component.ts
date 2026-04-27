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
  styles: [
    `
      :host { display: contents; }

      .dph-dialog__subheader {
        margin: 0.125rem 0 0;
        font-size: 0.8125rem;
        color: var(--ep-color-neutral-600);
      }

      .dph-dialog__body {
        position: relative;
      }

      .dph-dialog__loading {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background-color: rgba(255, 255, 255, 0.85);
        color: var(--ep-color-neutral-700);
        font-size: 0.875rem;
        font-weight: 500;
      }

      .dph-dialog__footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .dph-dialog__footer[data-align='left'] { justify-content: flex-start; }
      .dph-dialog__footer[data-align='center'] { justify-content: center; }
      .dph-dialog__footer[data-align='right'] { justify-content: flex-end; }
      .dph-dialog__footer[data-align='between'] { justify-content: space-between; }

      :host ::ng-deep .dph-dialog .p-dialog-content {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      :host ::ng-deep .dph-dialog .p-dialog-content > .dph-dialog__body {
        overflow-y: auto;
        overscroll-behavior: contain;
        flex: 1;
        min-height: 0;
        padding: var(--dph-dialog-content-padding, 1.5rem);
      }
      :host ::ng-deep .dph-dialog[data-no-padding] .p-dialog-content > .dph-dialog__body {
        padding: 0;
      }
    `,
  ],
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
