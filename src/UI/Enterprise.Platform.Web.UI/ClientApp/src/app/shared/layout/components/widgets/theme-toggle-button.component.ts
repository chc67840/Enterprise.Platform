/**
 * ─── widgets/theme-toggle-button ────────────────────────────────────────────────
 *
 * Cycles light → dark → system (or just light → dark when
 * `config.includeSystem === false`). Reads + writes via `ThemeService`.
 *
 * Tone-aware via [data-tone] (Tailwind-JIT-safe pattern).
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

import { ThemeService } from '@core/services';
import type { NavThemeToggleConfig } from '@shared/layout';

@Component({
  selector: 'app-theme-toggle-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule],
  template: `
    <button
      type="button"
      class="ep-theme-btn"
      [attr.data-tone]="tone()"
      [pTooltip]="tooltip()"
      tooltipPosition="bottom"
      [attr.aria-label]="tooltip()"
      (click)="onClick()"
    >
      <i [class]="icon()" aria-hidden="true"></i>
    </button>
  `,
  styles: [
    `
      .ep-theme-btn {
        display: inline-flex;
        height: 2.75rem;
        width: 2.75rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        background-color: transparent;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-theme-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-theme-btn[data-tone='light'] { color: var(--ep-text-secondary); }
      .ep-theme-btn[data-tone='light']:hover { background-color: var(--ep-surface-100); color: var(--ep-text-primary); }
      .ep-theme-btn[data-tone='dark'] { color: rgba(255, 255, 255, 0.92); }
      .ep-theme-btn[data-tone='dark']:hover { background-color: rgba(255, 255, 255, 0.12); color: #fff; }
    `,
  ],
})
export class ThemeToggleButtonComponent {
  private readonly theme = inject(ThemeService);

  readonly config = input.required<NavThemeToggleConfig>();
  readonly tone = input<'light' | 'dark'>('dark');

  protected readonly icon = computed(() => {
    switch (this.theme.mode()) {
      case 'light': return 'pi pi-sun';
      case 'dark': return 'pi pi-moon';
      default: return 'pi pi-desktop';
    }
  });

  protected readonly tooltip = computed(() => {
    const m = this.theme.mode();
    return `Theme: ${m === 'system' ? 'System' : m === 'dark' ? 'Dark' : 'Light'} (click to cycle)`;
  });

  protected onClick(): void {
    if (this.config().includeSystem === false) {
      // Two-way toggle when system is disabled.
      const next = this.theme.mode() === 'dark' ? 'light' : 'dark';
      this.theme.setMode(next);
    } else {
      this.theme.cycle();
    }
  }
}
