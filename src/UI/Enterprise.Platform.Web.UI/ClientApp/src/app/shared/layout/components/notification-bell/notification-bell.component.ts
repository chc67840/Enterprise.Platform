/**
 * ─── shared/layout/components/notification-bell ─────────────────────────────────
 *
 * Spec D5. Bell icon + count badge → PrimeNG OverlayPanel listing up to 8
 * notifications with severity-coloured icons, 2-line message clamp,
 * relative timestamps, "View all" footer link.
 *
 * Config: { enabled, maxBadgeCount?, viewAllRoute? } from `NavBellWidgetConfig`.
 * Data: `[notifications]: readonly NavNotification[]` — host owns the feed.
 *
 * Outputs collapse into the parent navbar's single `(navAction)` dispatcher
 * via `(itemClick)` (re-emitted with `source: 'notification'`).
 *
 * Per-spec a11y:
 *   - Trigger has `aria-label` naming the unread count
 *   - Popover content is `<ul role="list">`
 *   - Bell tone is dark-aware via `[data-tone]` (Tailwind v4 JIT-safe pattern)
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { BadgeModule } from 'primeng/badge';
import { type Popover, PopoverModule } from 'primeng/popover';

import type {
  NavBellWidgetConfig,
  NavNotification,
  NavNotificationLevel,
} from '@shared/layout';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeModule, PopoverModule, DatePipe, NgClass],
  template: `
    <button
      type="button"
      class="ep-bell-btn"
      [attr.data-tone]="tone()"
      [attr.aria-label]="ariaLabel()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="isOpen()"
      (click)="onTriggerClick($event)"
    >
      <i class="pi pi-bell ep-bell-icon" aria-hidden="true"></i>
      @if (unreadCount() > 0) {
        <p-badge
          [value]="badgeLabel()"
          severity="danger"
          styleClass="!absolute !-right-1 !-top-1"
        />
      }
    </button>

    <p-popover
      #popover
      appendTo="body"
      styleClass="ep-bell-popover w-[340px] max-w-[90vw]"
      (onShow)="isOpen.set(true)"
      (onHide)="isOpen.set(false)"
    >
      <header class="flex items-center justify-between border-b border-[color:var(--ep-color-neutral-200)] px-4 py-3">
        <h3 class="text-sm font-semibold text-[color:var(--ep-color-neutral-900)]">{{ heading() }}</h3>
        @if (unreadCount() > 0) {
          <span class="rounded-full bg-[color:var(--ep-color-danger-50)] px-2 py-0.5 text-xs font-medium text-[color:var(--ep-color-danger-700)]">
            {{ unreadCount() }} unread
          </span>
        }
      </header>

      @if (visibleItems().length === 0) {
        <div class="flex flex-col items-center justify-center px-4 py-10 text-center">
          <i class="pi pi-check-circle text-3xl text-[color:var(--ep-color-palmetto-500)]" aria-hidden="true"></i>
          <p class="mt-2 text-sm text-[color:var(--ep-color-neutral-600)]">You're all caught up!</p>
        </div>
      } @else {
        <ul role="list" class="max-h-[400px] divide-y divide-[color:var(--ep-color-neutral-200)] overflow-y-auto">
          @for (n of visibleItems(); track n.id) {
            <li>
              <button
                type="button"
                class="ep-bell-item flex w-full items-start gap-3 px-4 py-3 text-left"
                (click)="onItemClick(n)"
              >
                <i
                  [ngClass]="iconFor(n.level)"
                  class="mt-0.5 text-base"
                  aria-hidden="true"
                ></i>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-2">
                    <p
                      class="truncate text-sm font-medium"
                      [class.text-[color:var(--ep-color-neutral-900)]]="!n.read"
                      [class.text-[color:var(--ep-color-neutral-600)]]="n.read"
                    >
                      {{ n.title }}
                    </p>
                    <time class="shrink-0 text-[11px] text-[color:var(--ep-color-neutral-500)]">
                      {{ n.createdAt | date: 'shortTime' }}
                    </time>
                  </div>
                  @if (n.message) {
                    <p class="mt-0.5 line-clamp-2 text-xs text-[color:var(--ep-color-neutral-600)]">
                      {{ n.message }}
                    </p>
                  }
                </div>
                @if (!n.read) {
                  <span
                    class="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--ep-color-primary-500)]"
                    aria-label="Unread"
                  ></span>
                }
              </button>
            </li>
          }
        </ul>
      }

      @if (viewAllRoute()) {
        <footer class="border-t border-[color:var(--ep-color-neutral-200)] px-4 py-2 text-center">
          <button
            type="button"
            class="text-xs font-semibold text-[color:var(--ep-color-primary-700)] hover:underline"
            (click)="onViewAllClick()"
          >
            View all
          </button>
        </footer>
      }
    </p-popover>
  `,
  styles: [
    /*
     * Tone-aware trigger via [data-tone] selectors (Tailwind v4 JIT can't see
     * computed class strings; lesson from Phase E). Dark = white icon on
     * indigo chrome; light = neutral icon on surface.
     */
    `
      .ep-bell-btn {
        position: relative;
        display: inline-flex;
        height: 2.75rem;
        width: 2.75rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        background-color: transparent;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-bell-btn:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
      .ep-bell-icon { font-size: 1.125rem; line-height: 1; }

      .ep-bell-btn[data-tone='light'] { color: var(--ep-text-secondary); }
      .ep-bell-btn[data-tone='light']:hover {
        background-color: var(--ep-surface-100);
        color: var(--ep-text-primary);
      }
      .ep-bell-btn[data-tone='dark'] { color: rgba(255, 255, 255, 0.92); }
      .ep-bell-btn[data-tone='dark']:hover {
        background-color: rgba(255, 255, 255, 0.12);
        color: #ffffff;
      }

      .ep-bell-item:hover {
        background-color: var(--ep-color-primary-50);
      }
      .ep-bell-item:focus-visible {
        outline: 2px solid var(--ep-color-primary-500);
        outline-offset: -2px;
      }
    `,
  ],
})
export class NotificationBellComponent {
  private readonly router = inject(Router);

  /** Bell-widget config — drives `enabled`, `maxBadgeCount`, `viewAllRoute`. */
  readonly config = input.required<NavBellWidgetConfig>();

  /** Notification feed — host owns the fetch (BFF, websocket, mock). */
  readonly notifications = input<readonly NavNotification[]>([]);

  /** Heading shown on the popover header (e.g. "Notifications", "Messages"). */
  readonly heading = input<string>('Notifications');

  /** Visual tone for the trigger button — see styles. */
  readonly tone = input<'light' | 'dark'>('dark');

  /** Re-emitted to the navbar host so it can route or open a side panel. */
  readonly itemClick = output<NavNotification>();

  /** Emitted when the popover footer "View all" is clicked. Host can also rely on viewAllRoute auto-nav. */
  readonly viewAllClick = output<void>();

  @ViewChild('popover') popover!: Popover;

  /** Mirrors PrimeNG's onShow/onHide so the trigger can expose aria-expanded. */
  protected readonly isOpen = signal<boolean>(false);

  /**
   * stopPropagation here defends against a documented PrimeNG hazard: the
   * Popover registers a global click listener while open so an outside click
   * dismisses it. If a previous Popover (for any other widget) left a stale
   * listener attached, the SAME click that opens this popover can be caught
   * by that listener and treated as "outside" — net effect: open + close on
   * one tap, requiring a second tap to actually open. Stopping propagation
   * scopes the trigger click to this button.
   */
  protected onTriggerClick(event: Event): void {
    event.stopPropagation();
    this.popover.toggle(event);
  }

  // ── computed view-model ────────────────────────────────────────────────

  /** First N notifications (max 8 per spec). */
  protected readonly visibleItems = computed<readonly NavNotification[]>(() =>
    this.notifications().slice(0, 8),
  );

  protected readonly unreadCount = computed<number>(() =>
    this.notifications().filter((n) => !n.read).length,
  );

  protected readonly badgeLabel = computed<string>(() => {
    const cap = this.config().maxBadgeCount ?? 99;
    const c = this.unreadCount();
    return c > cap ? `${cap}+` : String(c);
  });

  protected readonly viewAllRoute = computed(() => this.config().viewAllRoute);

  protected readonly ariaLabel = computed<string>(() => {
    const c = this.unreadCount();
    if (c === 0) return `${this.heading()}, none unread`;
    if (c === 1) return `${this.heading()}, 1 unread`;
    return `${this.heading()}, ${c} unread`;
  });

  /** PrimeIcons class per severity. Drives both icon glyph + colour token. */
  protected iconFor(level: NavNotificationLevel): string {
    switch (level) {
      case 'critical':
        return 'pi pi-exclamation-circle text-[color:var(--ep-color-danger-700)]';
      case 'warning':
        return 'pi pi-exclamation-triangle text-[color:var(--ep-color-jessamine-700)]';
      case 'success':
        return 'pi pi-check-circle text-[color:var(--ep-color-palmetto-700)]';
      default:
        return 'pi pi-info-circle text-[color:var(--ep-color-primary-700)]';
    }
  }

  protected onItemClick(n: NavNotification): void {
    this.itemClick.emit(n);
    if (n.deepLink && typeof n.deepLink === 'string') {
      void this.router.navigateByUrl(n.deepLink);
    } else if (Array.isArray(n.deepLink)) {
      void this.router.navigate([...n.deepLink]);
    }
  }

  protected onViewAllClick(): void {
    this.viewAllClick.emit();
    const route = this.viewAllRoute();
    if (typeof route === 'string') {
      void this.router.navigateByUrl(route);
    } else if (Array.isArray(route)) {
      void this.router.navigate([...route]);
    }
  }
}
