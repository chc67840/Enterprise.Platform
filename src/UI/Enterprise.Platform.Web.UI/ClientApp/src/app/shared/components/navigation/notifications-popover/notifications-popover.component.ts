/**
 * ─── NOTIFICATIONS POPOVER ─────────────────────────────────────────────────────
 *
 * Bell icon + count badge in the top nav. Clicking opens a popover with a
 * scrollable list of recent notifications + "Mark all read" / "View all"
 * affordances.
 *
 * PHASE-1 SCOPE
 *   The list is mock data held as a signal — the real wiring lands when the
 *   notifications BFF endpoint is published. The component shape is the
 *   stable contract; only the data source moves.
 *
 * EVENTS
 *   - `(notificationClick)` — emitted when the user picks an item. Carries
 *     the notification id so the host can route to its source. Closing the
 *     popover after the click is the host's responsibility (use the
 *     `popover` ViewChild if needed).
 *   - `(viewAllClick)` — emitted when the user picks "View all".
 *
 * ACCESSIBILITY
 *   - Trigger has `aria-label` describing the count, so screen readers
 *     announce "3 new notifications" not just "Notifications button".
 *   - Popover content is a `<ul role="list">` for proper SR navigation.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  output,
  signal,
} from '@angular/core';
import { BadgeModule } from 'primeng/badge';
import { type Popover, PopoverModule } from 'primeng/popover';

/** Minimal notification shape — kept narrow so the eventual BFF DTO can extend it. */
export interface NavNotification {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  /** ISO-8601 timestamp. Rendered with relative formatting (e.g. "2m ago"). */
  readonly createdAt: string;
  readonly read: boolean;
  readonly severity?: 'info' | 'success' | 'warning' | 'danger';
}

/** Mock data for Phase-1 — replaced by BFF call when endpoint ships. */
const MOCK_NOTIFICATIONS: readonly NavNotification[] = [
  {
    id: 'n1',
    title: 'Welcome to Enterprise Platform',
    body: 'Take a tour of your dashboard to get started.',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    read: false,
    severity: 'info',
  },
  {
    id: 'n2',
    title: 'Permission updated',
    body: 'Your access to the Reports module was approved.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
    severity: 'success',
  },
  {
    id: 'n3',
    title: 'Maintenance window scheduled',
    body: 'Friday 02:00–02:30 UTC. Plan accordingly.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    severity: 'warning',
  },
];

@Component({
  selector: 'app-notifications-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeModule, PopoverModule],
  template: `
    <button
      type="button"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-ep-md text-[color:var(--ep-text-secondary)] hover:bg-[color:var(--ep-surface-100)] focus:outline-none focus-visible:shadow-[var(--ep-shadow-focus)]"
      [attr.aria-label]="ariaLabel()"
      (click)="popover.toggle($event)"
    >
      <i class="pi pi-bell text-lg" aria-hidden="true"></i>
      @if (unreadCount() > 0) {
        <p-badge
          [value]="unreadCount() > 99 ? '99+' : unreadCount().toString()"
          severity="danger"
          styleClass="!absolute !-right-1 !-top-1"
        />
      }
    </button>

    <p-popover #popover styleClass="w-80 max-w-[90vw]">
      <div class="flex items-center justify-between border-b border-[color:var(--ep-border)] px-4 py-3">
        <h3 class="text-sm font-semibold text-[color:var(--ep-text-primary)]">Notifications</h3>
        @if (unreadCount() > 0) {
          <button
            type="button"
            class="text-xs font-medium text-[color:var(--ep-color-primary-600)] hover:underline"
            (click)="markAllRead()"
          >
            Mark all read
          </button>
        }
      </div>

      @if (notifications().length === 0) {
        <div class="px-4 py-8 text-center text-sm text-[color:var(--ep-text-muted)]">
          You're all caught up.
        </div>
      } @else {
        <ul role="list" class="max-h-80 divide-y divide-[color:var(--ep-border)] overflow-y-auto">
          @for (n of notifications(); track n.id) {
            <li>
              <button
                type="button"
                class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[color:var(--ep-surface-100)] focus:bg-[color:var(--ep-surface-100)] focus:outline-none"
                (click)="onItemClick(n)"
              >
                <span
                  class="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  [class]="dotClass(n)"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium"
                    [class.text-[color:var(--ep-text-primary)]]="!n.read"
                    [class.text-[color:var(--ep-text-secondary)]]="n.read"
                  >
                    {{ n.title }}
                  </p>
                  @if (n.body) {
                    <p class="mt-0.5 line-clamp-2 text-xs text-[color:var(--ep-text-muted)]">
                      {{ n.body }}
                    </p>
                  }
                  <p class="mt-1 text-xs text-[color:var(--ep-text-muted)]">
                    {{ relativeTime(n.createdAt) }}
                  </p>
                </div>
              </button>
            </li>
          }
        </ul>
      }

      <div class="border-t border-[color:var(--ep-border)] px-4 py-2 text-center">
        <button
          type="button"
          class="text-xs font-medium text-[color:var(--ep-color-primary-600)] hover:underline"
          (click)="viewAllClick.emit()"
        >
          View all
        </button>
      </div>
    </p-popover>
  `,
})
export class NotificationsPopoverComponent {
  /** Mock signal — swap to a service-backed signal when BFF endpoint exists. */
  readonly notifications = signal<readonly NavNotification[]>(MOCK_NOTIFICATIONS);

  readonly unreadCount = computed<number>(() =>
    this.notifications().filter((n) => !n.read).length,
  );

  /** Aria label that names the count, so screen readers don't have to count themselves. */
  readonly ariaLabel = computed<string>(() => {
    const c = this.unreadCount();
    if (c === 0) return 'Notifications, none unread';
    if (c === 1) return '1 unread notification';
    return `${c} unread notifications`;
  });

  readonly notificationClick = output<NavNotification>();
  readonly viewAllClick = output<void>();

  @ViewChild('popover') popover!: Popover;

  /**
   * Marks every notification as read locally. Real impl calls the BFF first
   * and only updates state on success — but this placeholder is harmless
   * (server is the source of truth in prod).
   */
  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  /**
   * Click handler: marks the picked item read locally and notifies the host.
   * The host decides whether to close the popover; we don't auto-close so
   * a user can quickly dismiss several without re-opening.
   */
  onItemClick(n: NavNotification): void {
    if (!n.read) {
      this.notifications.update((list) =>
        list.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      );
    }
    this.notificationClick.emit(n);
  }

  /** Tailwind class for the unread dot. Severity-aware. */
  dotClass(n: NavNotification): string {
    if (n.read) return 'bg-transparent';
    switch (n.severity) {
      case 'success':
        return 'bg-[color:var(--ep-color-success)]';
      case 'warning':
        return 'bg-[color:var(--ep-color-warning)]';
      case 'danger':
        return 'bg-[color:var(--ep-color-danger)]';
      default:
        return 'bg-[color:var(--ep-color-primary-500)]';
    }
  }

  /**
   * Coarse relative-time formatter. Avoids a full Intl.RelativeTimeFormat
   * dance for what is currently a placeholder list — substitute when the
   * real notifications service ships.
   */
  relativeTime(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '';
    const deltaSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (deltaSec < 60) return 'just now';
    if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
    if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
    return `${Math.floor(deltaSec / 86400)}d ago`;
  }
}
