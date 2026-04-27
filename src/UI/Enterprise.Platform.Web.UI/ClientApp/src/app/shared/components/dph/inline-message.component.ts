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
  styles: [
    `
      :host { display: block; }
      .dph-msg {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        padding: 0.75rem 1rem;
        border: 1px solid;
        border-left-width: 4px;
        border-radius: var(--ep-radius-md);
        font-size: 0.875rem;
        line-height: 1.4;
      }
      .dph-msg[data-rounded='true'] { border-radius: var(--ep-radius-lg); }
      .dph-msg[data-compact='true'] {
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
      }

      .dph-msg__icon { font-size: 1rem; margin-top: 0.125rem; flex-shrink: 0; }
      .dph-msg__body { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
      .dph-msg__summary { font-weight: 600; }
      .dph-msg__detail { color: inherit; opacity: 0.9; }
      .dph-msg__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }

      .dph-msg__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: var(--ep-radius-sm);
        background-color: transparent;
        border: none;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
        flex-shrink: 0;
      }
      .dph-msg__close:hover { opacity: 1; background-color: rgba(0, 0, 0, 0.06); }
      .dph-msg__close:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-msg__close i { pointer-events: none; }

      /* severity → outline (default) */
      .dph-msg[data-severity='info'] { background-color: var(--ep-color-primary-50); border-color: var(--ep-color-primary-200); color: var(--ep-color-primary-800); }
      .dph-msg[data-severity='success'] { background-color: var(--ep-color-palmetto-50); border-color: var(--ep-color-palmetto-200); color: var(--ep-color-palmetto-800); }
      .dph-msg[data-severity='warning'] { background-color: var(--ep-color-jessamine-50); border-color: var(--ep-color-jessamine-300); color: var(--ep-color-jessamine-800); }
      .dph-msg[data-severity='danger'] { background-color: var(--ep-color-danger-50); border-color: var(--ep-color-danger-200); color: var(--ep-color-danger-700); }
      .dph-msg[data-severity='neutral'] { background-color: var(--ep-color-neutral-50); border-color: var(--ep-color-neutral-200); color: var(--ep-color-neutral-700); }

      /* filled variant */
      .dph-msg[data-filled='true'][data-severity='info'] { background-color: var(--ep-color-primary-700); color: #fff; border-color: var(--ep-color-primary-700); }
      .dph-msg[data-filled='true'][data-severity='success'] { background-color: var(--ep-color-palmetto-700); color: #fff; border-color: var(--ep-color-palmetto-700); }
      .dph-msg[data-filled='true'][data-severity='warning'] { background-color: var(--ep-color-jessamine-500); color: var(--ep-color-primary-900); border-color: var(--ep-color-jessamine-500); }
      .dph-msg[data-filled='true'][data-severity='danger'] { background-color: var(--ep-color-danger-600); color: #fff; border-color: var(--ep-color-danger-600); }
      .dph-msg[data-filled='true'][data-severity='neutral'] { background-color: var(--ep-color-neutral-700); color: #fff; border-color: var(--ep-color-neutral-700); }
    `,
  ],
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
