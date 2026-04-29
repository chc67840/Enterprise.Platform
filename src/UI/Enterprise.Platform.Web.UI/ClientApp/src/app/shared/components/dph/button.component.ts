/**
 * ─── DPH UI KIT — BUTTON ────────────────────────────────────────────────────────
 *
 * Universal button. Variants: primary | secondary | ghost | outline | link
 * | danger | icon. Sizes: xs | sm | md | lg | xl. Loading + disabled +
 * raised + rounded all supported via direct attributes (no PrimeNG required).
 *
 * Why not just use <p-button>? PrimeNG's button is solid but its theming
 * surface clashes with our Tailwind v4 + tokens.css pattern; loading state
 * has its own quirks; icon-only accessibility needs explicit aria-label.
 * Wrapping standardizes all of those.
 *
 *   <dph-button label="Save" icon="pi pi-save" (clicked)="save()" />
 *   <dph-button variant="danger" label="Delete" [loading]="store.deleting()" />
 *   <dph-button variant="icon" icon="pi pi-cog" ariaLabel="Settings" />
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

import type { Severity, Size, Variant } from './dph.types';

@Component({
  selector: 'dph-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TooltipModule],
  template: `
    <button
      [type]="type()"
      class="dph-btn"
      [class]="variantClass()"
      [class.dph-btn--full]="fullWidth()"
      [class.dph-btn--rounded]="rounded()"
      [class.dph-btn--raised]="raised()"
      [attr.data-size]="size()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      [attr.aria-label]="effectiveAriaLabel()"
      [pTooltip]="tooltip() || undefined"
      tooltipPosition="bottom"
      (click)="onClick($event)"
    >
      @if (loading()) {
        <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
        @if (loadingText()) {
          <span class="dph-btn__label">{{ loadingText() }}</span>
        } @else if (label() && !iconOnly()) {
          <span class="dph-btn__label">{{ label() }}</span>
        }
      } @else {
        @if (icon() && iconPosition() === 'left') {
          <i [class]="icon()" aria-hidden="true"></i>
        }
        @if (label() && !iconOnly()) {
          <span class="dph-btn__label">{{ label() }}</span>
        }
        @if (icon() && iconPosition() === 'right') {
          <i [class]="icon()" aria-hidden="true"></i>
        }
        @if (badge()) {
          <span class="dph-btn__badge" [attr.data-severity]="badgeSeverity()">{{ badge() }}</span>
        }
      }
    </button>
  `,
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  // ── Inputs (also usable via a single config object if you prefer) ────────

  readonly label = input<string>('');
  readonly icon = input<string>('');
  readonly iconPosition = input<'left' | 'right'>('left');
  readonly variant = input<Variant | 'icon'>('primary');
  readonly size = input<Size>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly loadingText = input<string>('');
  readonly fullWidth = input<boolean>(false);
  readonly rounded = input<boolean>(false);
  readonly raised = input<boolean>(false);
  readonly badge = input<string>('');
  readonly badgeSeverity = input<Severity>('danger');
  readonly ariaLabel = input<string>('');
  readonly tooltip = input<string>('');

  readonly clicked = output<MouseEvent>();

  // ── Computed ─────────────────────────────────────────────────────────────

  protected readonly iconOnly = computed(
    () => this.variant() === 'icon' || (!!this.icon() && !this.label()),
  );

  protected readonly variantClass = computed(() => `dph-btn--${this.variant()}`);

  /** Icon-only buttons require an explicit aria-label. */
  protected readonly effectiveAriaLabel = computed(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    if (this.iconOnly()) return this.tooltip() || 'Button';
    return null;
  });

  protected onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) return;
    this.clicked.emit(event);
  }
}
