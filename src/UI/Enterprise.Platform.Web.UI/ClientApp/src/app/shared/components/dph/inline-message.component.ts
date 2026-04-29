/**
 * ─── DPH UI KIT — INLINE MESSAGE ────────────────────────────────────────────────
 *
 * Inline alert / message panel — for in-page contextual feedback that
 * isn't a transient toast. 5 severities, optional icon override, optional
 * actions, dismissible.
 *
 *   <dph-inline-message [config]="{ severity: 'warning', summary: 'Stale data',
 *     detail: 'Data is from 5 minutes ago.', closable: true,
 *     actions: [{ label: 'Refresh', key: 'refresh' }] }"
 *     (action)="onAction($event)"
 *     (closed)="dismissed.set(true)" />
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ButtonComponent } from './button.component';
import type { InlineMessageConfig, Severity } from './dph.types';

const ICONS: Record<Severity, string> = {
  success: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
  warning: 'pi pi-exclamation-triangle',
  danger: 'pi pi-times-circle',
  neutral: 'pi pi-circle',
};

@Component({
  selector: 'dph-inline-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  template: `
    @if (visible()) {
      <div
        class="dph-msg"
        [attr.data-severity]="config().severity"
        [attr.data-filled]="!!config().filled"
        [attr.data-compact]="!!config().compact"
        [attr.data-rounded]="!!config().rounded"
        [attr.role]="alertRole()"
        [attr.aria-live]="alertRole() === 'alert' ? 'assertive' : 'polite'"
      >
        <i [class]="effectiveIcon()" class="dph-msg__icon" aria-hidden="true"></i>
        <div class="dph-msg__body">
          @if (config().summary) {
            <strong class="dph-msg__summary">{{ config().summary }}</strong>
          }
          @if (config().detail) {
            <span class="dph-msg__detail">{{ config().detail }}</span>
          }
          @if (config().actions?.length) {
            <div class="dph-msg__actions">
              @for (a of config().actions || []; track a.key) {
                <dph-button
                  [label]="a.label"
                  [variant]="a.variant || 'link'"
                  size="sm"
                  (clicked)="action.emit(a.key)"
                />
              }
            </div>
          }
        </div>
        @if (config().closable) {
          <button
            type="button"
            class="dph-msg__close"
            aria-label="Dismiss message"
            (click)="dismiss()"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        }
      </div>
    }
  `,
  styleUrl: './inline-message.component.scss',
})
export class InlineMessageComponent {
  readonly config = input.required<InlineMessageConfig>();
  readonly action = output<string>();
  readonly closed = output<void>();

  protected readonly visible = signal<boolean>(true);

  protected readonly effectiveIcon = computed(
    () => this.config().icon || ICONS[this.config().severity],
  );

  protected readonly alertRole = computed<'alert' | 'status'>(() => {
    const s = this.config().severity;
    return s === 'danger' || s === 'warning' ? 'alert' : 'status';
  });

  protected dismiss(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
