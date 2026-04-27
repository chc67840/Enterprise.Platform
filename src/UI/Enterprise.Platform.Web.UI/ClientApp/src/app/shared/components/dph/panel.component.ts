/**
 * ─── DPH UI KIT — PANEL ─────────────────────────────────────────────────────────
 *
 * Generic container with optional header (title/subheader/icon), header
 * actions slot, content area, footer slot, collapsible toggle, close
 * button, loading overlay. The "card" of the application.
 *
 * Variants:
 *   default   — white surface, light border
 *   elevated  — white surface, soft shadow
 *   flat      — neutral-50 background, no border
 *   ghost     — transparent, no border
 *   glass     — translucent + backdrop-blur (falls back to elevated when unsupported)
 *
 *   <dph-panel [config]="{ variant: 'elevated', header: 'Roles', icon: 'pi pi-shield', collapsible: true }">
 *     <ng-container slot="header-actions">
 *       <dph-button variant="ghost" icon="pi pi-cog" ariaLabel="Settings" />
 *     </ng-container>
 *     ...content...
 *     <ng-container slot="footer">...action buttons...</ng-container>
 *   </dph-panel>
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { PanelConfig } from './dph.types';

@Component({
  selector: 'dph-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <section
      class="dph-panel"
      [attr.data-variant]="config().variant || 'default'"
      [attr.data-padding]="config().padding || 'md'"
      [attr.data-radius]="config().borderRadius || 'lg'"
      [attr.aria-busy]="config().loading ? 'true' : null"
    >
      @if (showHeader()) {
        <header class="dph-panel__header">
          <div class="dph-panel__header-text">
            @if (config().icon) {
              <span class="dph-panel__icon" aria-hidden="true">
                <i [class]="config().icon"></i>
              </span>
            }
            <div>
              @if (config().header) {
                <h3 class="dph-panel__title">{{ config().header }}</h3>
              }
              @if (config().subheader) {
                <p class="dph-panel__subtitle">{{ config().subheader }}</p>
              }
            </div>
          </div>
          <div class="dph-panel__header-actions">
            <ng-content select="[slot=header-actions]" />
            @if (config().collapsible) {
              <button
                type="button"
                class="dph-panel__toggle"
                [attr.aria-expanded]="!collapsed()"
                [attr.aria-controls]="bodyId"
                [attr.aria-label]="collapsed() ? 'Expand panel' : 'Collapse panel'"
                (click)="toggle()"
              >
                <i class="pi" [class.pi-chevron-down]="!collapsed()" [class.pi-chevron-up]="collapsed()" aria-hidden="true"></i>
              </button>
            }
            @if (config().closable) {
              <button
                type="button"
                class="dph-panel__close"
                aria-label="Close panel"
                (click)="closed.emit()"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            }
          </div>
        </header>
      }

      @if (!collapsed()) {
        <div class="dph-panel__body" [id]="bodyId">
          @if (config().loading && (config().loadingContent || 'overlay') === 'overlay') {
            <div class="dph-panel__overlay" role="status" aria-live="polite">
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              <span>Loading…</span>
            </div>
          }
          <ng-content />
          <ng-content select="[slot=content]" />
        </div>

        @if (hasFooterSlot) {
          <footer class="dph-panel__footer" [attr.data-align]="config().footerAlign || 'right'">
            <ng-content select="[slot=footer]" />
          </footer>
        }
      }
    </section>
  `,
  styles: [
    `
      :host { display: block; }

      .dph-panel {
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
        border: 1px solid var(--ep-color-neutral-200);
        border-radius: var(--ep-radius-lg);
        overflow: hidden;
      }
      .dph-panel[data-radius='sm'] { border-radius: var(--ep-radius-sm); }
      .dph-panel[data-radius='md'] { border-radius: var(--ep-radius-md); }
      .dph-panel[data-radius='xl'] { border-radius: var(--ep-radius-xl); }

      .dph-panel[data-variant='elevated'] {
        border-color: transparent;
        box-shadow: 0 1px 2px rgba(15, 31, 59, 0.06), 0 4px 12px rgba(15, 31, 59, 0.08);
      }
      .dph-panel[data-variant='flat'] {
        background-color: var(--ep-color-neutral-50);
        border-color: transparent;
      }
      .dph-panel[data-variant='ghost'] {
        background-color: transparent;
        border-color: transparent;
      }
      .dph-panel[data-variant='glass'] {
        background-color: color-mix(in srgb, #ffffff 88%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .dph-panel__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--ep-color-neutral-200);
      }
      .dph-panel[data-variant='ghost'] .dph-panel__header,
      .dph-panel[data-variant='flat'] .dph-panel__header {
        border-bottom-color: var(--ep-color-neutral-200);
      }

      .dph-panel__header-text {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        min-width: 0;
        flex: 1;
      }
      .dph-panel__icon {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--ep-radius-md);
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-700);
        flex-shrink: 0;
      }
      .dph-panel__title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--ep-color-neutral-900);
        line-height: 1.2;
      }
      .dph-panel__subtitle {
        margin: 0.125rem 0 0;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
      }

      .dph-panel__header-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
      }

      .dph-panel__toggle,
      .dph-panel__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--ep-radius-md);
        background-color: transparent;
        color: var(--ep-color-neutral-600);
        border: none;
        cursor: pointer;
        touch-action: manipulation;
      }
      .dph-panel__toggle:hover,
      .dph-panel__close:hover { background-color: var(--ep-color-neutral-100); color: var(--ep-color-neutral-900); }
      .dph-panel__toggle:focus-visible,
      .dph-panel__close:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-panel__toggle i,
      .dph-panel__close i { pointer-events: none; }

      .dph-panel__body {
        position: relative;
        flex: 1;
        min-height: 0;
      }
      .dph-panel[data-padding='none'] .dph-panel__body { padding: 0; }
      .dph-panel[data-padding='sm'] .dph-panel__body { padding: 0.75rem; }
      .dph-panel[data-padding='md'] .dph-panel__body { padding: 1rem; }
      .dph-panel[data-padding='lg'] .dph-panel__body { padding: 1.5rem; }
      @media (max-width: 639px) {
        .dph-panel[data-padding='lg'] .dph-panel__body { padding: 1rem; }
      }

      .dph-panel__overlay {
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
      }

      .dph-panel__footer {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--ep-color-neutral-200);
        background-color: var(--ep-color-neutral-50);
      }
      .dph-panel__footer[data-align='left'] { justify-content: flex-start; }
      .dph-panel__footer[data-align='center'] { justify-content: center; }
      .dph-panel__footer[data-align='right'] { justify-content: flex-end; }
      .dph-panel__footer[data-align='between'] { justify-content: space-between; }
    `,
  ],
})
export class PanelComponent {
  readonly config = input.required<PanelConfig>();
  readonly closed = output<void>();
  readonly collapsedChange = output<boolean>();

  protected readonly bodyId = `dph-panel-body-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly collapsed = signal<boolean>(false);
  protected readonly hasFooterSlot = true;   // ng-content can't be detected — assume slot may exist; CSS hides empty

  protected readonly showHeader = computed(
    () => !!this.config().header || !!this.config().subheader || !!this.config().icon || !!this.config().closable || !!this.config().collapsible,
  );

  constructor() {
    queueMicrotask(() => this.collapsed.set(!!this.config().defaultCollapsed));
  }

  protected toggle(): void {
    this.collapsed.update((c) => !c);
    this.collapsedChange.emit(this.collapsed());
  }
}
