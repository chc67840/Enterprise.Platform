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
  styles: [
    `
      :host { display: inline-flex; }
      :host([fullwidth]) { display: flex; width: 100%; }

      .dph-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        position: relative;
        min-height: 2.75rem;        /* WCAG 2.5.5 — 44px touch target */
        min-width: 2.75rem;
        padding: 0.5rem 1rem;
        border-radius: var(--ep-radius-md);
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        border: 1px solid transparent;
        background-color: transparent;
        color: var(--ep-text-primary);
        text-decoration: none;
        white-space: nowrap;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
      }
      .dph-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .dph-btn[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .dph-btn > i,
      .dph-btn > span { pointer-events: none; }
      .dph-btn--full { width: 100%; }
      .dph-btn--rounded { border-radius: 9999px; }
      .dph-btn--raised { box-shadow: 0 1px 2px rgba(15, 31, 59, 0.08), 0 2px 6px rgba(15, 31, 59, 0.10); }
      .dph-btn--raised:hover:not([disabled]) { box-shadow: 0 2px 4px rgba(15, 31, 59, 0.10), 0 6px 14px rgba(15, 31, 59, 0.15); }
      .dph-btn--raised:active:not([disabled]) { transform: translateY(1px); box-shadow: 0 1px 2px rgba(15, 31, 59, 0.08); }

      /* sizes via [data-size] */
      .dph-btn[data-size='xs'] { min-height: 2rem; min-width: 2rem; padding: 0.25rem 0.625rem; font-size: 0.75rem; }
      .dph-btn[data-size='sm'] { min-height: 2.25rem; min-width: 2.25rem; padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
      .dph-btn[data-size='md'] { /* default */ }
      .dph-btn[data-size='lg'] { min-height: 3rem; padding: 0.625rem 1.25rem; font-size: 0.9375rem; }
      .dph-btn[data-size='xl'] { min-height: 3.5rem; padding: 0.75rem 1.5rem; font-size: 1rem; }

      /* variants */
      .dph-btn--primary {
        background-color: var(--ep-color-primary-700);
        color: #ffffff;
        border-color: var(--ep-color-primary-700);
      }
      .dph-btn--primary:hover:not([disabled]) { background-color: var(--ep-color-primary-800); border-color: var(--ep-color-primary-800); }
      .dph-btn--primary:active:not([disabled]) { background-color: var(--ep-color-primary-900); }

      .dph-btn--secondary {
        background-color: var(--ep-color-neutral-100);
        color: var(--ep-color-neutral-900);
        border-color: var(--ep-color-neutral-200);
      }
      .dph-btn--secondary:hover:not([disabled]) { background-color: var(--ep-color-neutral-200); border-color: var(--ep-color-neutral-300); }

      .dph-btn--ghost {
        background-color: transparent;
        color: var(--ep-color-neutral-800);
      }
      .dph-btn--ghost:hover:not([disabled]) { background-color: var(--ep-color-neutral-100); }

      .dph-btn--outline {
        background-color: transparent;
        color: var(--ep-color-primary-700);
        border-color: var(--ep-color-primary-700);
      }
      .dph-btn--outline:hover:not([disabled]) { background-color: var(--ep-color-primary-50); }

      .dph-btn--link {
        background-color: transparent;
        color: var(--ep-color-primary-700);
        padding: 0;
        min-height: auto;
        min-width: auto;
        border: none;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .dph-btn--link:hover:not([disabled]) { color: var(--ep-color-primary-800); }

      .dph-btn--danger {
        background-color: var(--ep-color-danger-600);
        color: #ffffff;
        border-color: var(--ep-color-danger-600);
      }
      .dph-btn--danger:hover:not([disabled]) { background-color: var(--ep-color-danger-700); border-color: var(--ep-color-danger-700); }

      .dph-btn--icon {
        padding: 0;
        border-radius: var(--ep-radius-md);
      }
      .dph-btn--icon[data-size='md'] { width: 2.75rem; }

      /* badge — top-right pill on the button */
      .dph-btn__badge {
        position: absolute;
        top: -0.375rem;
        right: -0.375rem;
        min-width: 1.125rem;
        height: 1.125rem;
        padding: 0 0.375rem;
        border-radius: 9999px;
        background-color: var(--ep-color-danger-600);
        color: #ffffff;
        font-size: 0.625rem;
        font-weight: 700;
        line-height: 1.125rem;
        text-align: center;
      }
      .dph-btn__badge[data-severity='success'] { background-color: var(--ep-color-palmetto-600); }
      .dph-btn__badge[data-severity='warning'] { background-color: var(--ep-color-jessamine-500); color: var(--ep-color-primary-900); }
      .dph-btn__badge[data-severity='info'] { background-color: var(--ep-color-primary-600); }
      .dph-btn__badge[data-severity='neutral'] { background-color: var(--ep-color-neutral-500); }

      @media (prefers-reduced-motion: reduce) {
        .dph-btn { transition: none; }
      }
    `,
  ],
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
