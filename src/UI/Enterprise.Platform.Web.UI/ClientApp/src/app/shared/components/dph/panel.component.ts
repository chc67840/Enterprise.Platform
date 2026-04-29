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
  styleUrl: './panel.component.scss',
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
