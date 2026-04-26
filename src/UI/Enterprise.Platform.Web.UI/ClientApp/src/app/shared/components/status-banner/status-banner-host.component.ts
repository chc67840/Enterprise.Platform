/**
 * ─── STATUS BANNER HOST ─────────────────────────────────────────────────────────
 *
 * Renders 0..N banners stacked, in registry order, between the top-nav and
 * the main content. Driven entirely by `StatusBannerService` — features
 * push; this host renders.
 *
 * VISUAL TREATMENT
 *   Each severity uses brand tokens per UI-Color-Palette-Strategy.md:
 *     info        → `primary-50`  bg, `primary-700`  text, `primary-200`   border
 *     success     → `palmetto-50` bg, `palmetto-700` text, `palmetto-200`  border
 *     warning     → `jessamine-50` bg, `jessamine-700` text (AA), `jessamine-300` border
 *     danger      → `danger-50`   bg, `danger-700`   text, `danger-200`    border
 *     maintenance → `primary-50`  bg, `primary-700`  text, `jessamine-500` left border
 *                   (uses jessamine accent + maintenance icon to distinguish from info)
 *
 *   Iconography: every banner gets an icon. Color alone is insufficient for
 *   accessibility (WCAG 1.4.1).
 *
 * ACCESSIBILITY
 *   - `info` / `success` / `maintenance` use `role="status"` (polite live region)
 *   - `warning` / `danger`             use `role="alert"`  (assertive)
 *   - Focus ring on the dismiss button via `:focus-visible` (uses `--ep-shadow-focus`)
 *   - Min 44x44 touch target on the dismiss button per WCAG 2.5.5
 *   - Banner copy is semantic HTML: `<strong>` for the title, paragraph for the message
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { StatusBannerService, type StatusBanner, type StatusBannerSeverity } from '@core/services';

interface BannerView {
  readonly banner: StatusBanner;
  readonly icon: string;
  readonly role: 'status' | 'alert';
  readonly classes: string;
}

@Component({
  selector: 'app-status-banner-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    @if (views().length > 0) {
      <div class="space-y-px" aria-label="System notices">
        @for (view of views(); track view.banner.id) {
          <div
            [attr.role]="view.role"
            [class]="
              'flex items-start gap-3 px-4 py-2.5 text-sm border-b ' + view.classes
            "
          >
            <i [class]="'mt-0.5 ' + view.icon" aria-hidden="true"></i>

            <div class="flex-1">
              <strong class="font-semibold">{{ view.banner.title }}</strong>
              <span class="ml-1.5 opacity-90">{{ view.banner.message }}</span>
            </div>

            @if (view.banner.action) {
              <button
                type="button"
                (click)="view.banner.action.invoke()"
                class="rounded-md px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--ep-color-primary-500)]"
              >
                {{ view.banner.action.label }}
              </button>
            }

            @if (view.banner.dismissable) {
              <button
                type="button"
                (click)="dismiss(view.banner.id)"
                class="-m-2 inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--ep-color-primary-500)]"
                [attr.aria-label]="'Dismiss notice: ' + view.banner.title"
              >
                <i class="pi pi-times text-xs" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class StatusBannerHostComponent {
  private readonly service = inject(StatusBannerService);

  /** Pre-computed view-model: icon + role + class string per banner. */
  protected readonly views = computed<readonly BannerView[]>(() =>
    this.service.banners().map((banner) => this.toView(banner)),
  );

  protected dismiss(id: string): void {
    this.service.dismiss(id);
  }

  private toView(banner: StatusBanner): BannerView {
    const sev = banner.severity;
    return {
      banner,
      icon: banner.icon ?? DEFAULT_ICONS[sev],
      role: ASSERTIVE.has(sev) ? 'alert' : 'status',
      classes: SEVERITY_CLASSES[sev],
    };
  }
}

// ─── severity → presentation maps ────────────────────────────────────────────

const ASSERTIVE = new Set<StatusBannerSeverity>(['warning', 'danger']);

const DEFAULT_ICONS: Record<StatusBannerSeverity, string> = {
  info: 'pi pi-info-circle text-[color:var(--ep-color-primary-700)]',
  success: 'pi pi-check-circle text-[color:var(--ep-color-palmetto-700)]',
  warning: 'pi pi-exclamation-triangle text-[color:var(--ep-color-jessamine-700)]',
  danger: 'pi pi-times-circle text-[color:var(--ep-color-danger-700)]',
  maintenance: 'pi pi-wrench text-[color:var(--ep-color-jessamine-700)]',
};

const SEVERITY_CLASSES: Record<StatusBannerSeverity, string> = {
  info:
    'bg-[color:var(--ep-color-primary-50)] text-[color:var(--ep-color-primary-800)] ' +
    'border-[color:var(--ep-color-primary-200)]',
  success:
    'bg-[color:var(--ep-color-palmetto-50)] text-[color:var(--ep-color-palmetto-800)] ' +
    'border-[color:var(--ep-color-palmetto-200)]',
  warning:
    'bg-[color:var(--ep-color-jessamine-50)] text-[color:var(--ep-color-jessamine-800)] ' +
    'border-[color:var(--ep-color-jessamine-300)]',
  danger:
    'bg-[color:var(--ep-color-danger-50)] text-[color:var(--ep-color-danger-800)] ' +
    'border-[color:var(--ep-color-danger-200)]',
  maintenance:
    'bg-[color:var(--ep-color-primary-50)] text-[color:var(--ep-color-primary-800)] ' +
    'border-[color:var(--ep-color-primary-200)] border-l-4 border-l-[color:var(--ep-color-jessamine-500)]',
};
