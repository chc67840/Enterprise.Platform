/**
 * ─── StatusBadgeComponent ───────────────────────────────────────────────────────
 *
 * Severity-mapped pill used in data tables, detail views, and status
 * columns. Takes either a free-form label + variant, or a single status
 * string that maps via a caller-supplied dictionary.
 *
 * VARIANTS
 *   - `success` — completed / active / healthy
 *   - `warning` — pending / needs-attention
 *   - `danger`  — failed / deleted / critical
 *   - `info`    — neutral informational (draft / queued)
 *   - `neutral` — default / unknown
 *
 * USAGE
 *   ```html
 *   <app-status-badge variant="success" label="Active" />
 *   <app-status-badge [variant]="mapStatus(user.status)" [label]="user.status" />
 *   ```
 *
 * ACCESSIBILITY
 *   The colour + icon pairing means the variant is distinguishable without
 *   relying on colour alone (WCAG 1.4.1). Each variant ships with a
 *   representative PrimeIcon; callers can override via the `icon` input.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface VariantClasses {
  readonly container: string;
  readonly icon: string;
}

const VARIANT_MAP: Record<StatusVariant, VariantClasses> = {
  success: {
    container: 'bg-success-bg text-success',
    icon: 'pi-check-circle',
  },
  warning: {
    container: 'bg-warning-bg text-warning',
    icon: 'pi-exclamation-triangle',
  },
  danger: {
    container: 'bg-danger-bg text-danger',
    icon: 'pi-times-circle',
  },
  info: {
    container: 'bg-info-bg text-info',
    icon: 'pi-info-circle',
  },
  neutral: {
    container: 'bg-neutral-100 text-neutral-600',
    icon: 'pi-circle',
  },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {{ classes().container }}"
    >
      @if (iconClass()) {
        <i class="pi {{ iconClass() }} text-xs" aria-hidden="true"></i>
      }
      <span>{{ label() }}</span>
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input<StatusVariant>('neutral');
  /** Optional override for the default variant icon. Pass `null` to hide it. */
  readonly icon = input<string | null | undefined>(undefined);

  protected readonly classes = computed(() => VARIANT_MAP[this.variant()]);
  protected readonly iconClass = computed(() => {
    const override = this.icon();
    if (override === null) return null;
    return override ?? this.classes().icon;
  });
}
