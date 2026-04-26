/**
 * ─── widgets/quick-actions ──────────────────────────────────────────────────────
 *
 * Spec D6. Plus button → PrimeNG OverlayPanel listing every `QuickAction`
 * (icon + label + optional shortcut). Each pick emits `NavActionEvent`
 * with `source: 'quickAction'` + the action's `actionKey`.
 *
 * Permission gating per action — fail-open when no permission set.
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
import { type Popover, PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

import { AuthStore } from '@core/auth';
import type {
  NavActionEvent,
  NavQuickActionsConfig,
  QuickAction,
} from '@shared/layout';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopoverModule, TooltipModule],
  template: `
    <button
      type="button"
      class="ep-qa-trigger"
      [pTooltip]="config().label ?? 'Quick actions'"
      tooltipPosition="bottom"
      [attr.aria-label]="config().label ?? 'Quick actions'"
      aria-haspopup="menu"
      [attr.aria-expanded]="isOpen()"
      (click)="onTriggerClick($event)"
    >
      <i [class]="config().icon ?? 'pi pi-plus'" aria-hidden="true"></i>
    </button>

    <p-popover
      #popover
      appendTo="body"
      styleClass="w-[200px]"
      (onShow)="isOpen.set(true)"
      (onHide)="isOpen.set(false)"
    >
      <header class="border-b border-[color:var(--ep-color-neutral-200)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ep-color-neutral-500)]">
        {{ config().label ?? 'Quick actions' }}
      </header>
      <ul role="list" class="py-1">
        @for (action of visibleActions(); track action.id) {
          <li>
            <button
              type="button"
              class="ep-qa-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
              [disabled]="false"
              (click)="onPick(action)"
            >
              <span class="inline-flex items-center gap-2">
                @if (action.icon) {
                  <i [class]="action.icon + ' text-[color:var(--ep-color-primary-700)]'" aria-hidden="true"></i>
                }
                <span class="text-[color:var(--ep-color-neutral-900)]">{{ action.label }}</span>
              </span>
              @if (action.shortcut) {
                <kbd class="rounded bg-[color:var(--ep-color-neutral-100)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ep-color-neutral-600)]">
                  {{ action.shortcut }}
                </kbd>
              }
            </button>
          </li>
        }
      </ul>
    </p-popover>
  `,
  styles: [
    `
      .ep-qa-trigger {
        display: inline-flex;
        height: 2.75rem;
        width: 2.75rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        background-color: transparent;
        color: rgba(255, 255, 255, 0.92);
        transition: background-color 120ms ease;
      }
      .ep-qa-trigger:hover { background-color: rgba(255, 255, 255, 0.12); color: #fff; }
      .ep-qa-trigger:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      .ep-qa-item {
        background: transparent;
        border-radius: 0.375rem;
      }
      .ep-qa-item:hover { background-color: var(--ep-color-primary-50); }
      .ep-qa-item:focus-visible {
        outline: 2px solid var(--ep-color-primary-500);
        outline-offset: -2px;
      }
    `,
  ],
})
export class QuickActionsComponent {
  private readonly auth = inject(AuthStore);

  readonly config = input.required<NavQuickActionsConfig>();

  /** Spec D6 emits the standard navAction with source 'quickAction'. */
  readonly action = output<NavActionEvent>();

  @ViewChild('popover') popover!: Popover;

  /** Mirrors PrimeNG onShow/onHide for the trigger's aria-expanded. */
  protected readonly isOpen = signal<boolean>(false);

  /** stopPropagation prevents stale popover document listeners from eating the open click. */
  protected onTriggerClick(event: Event): void {
    event.stopPropagation();
    this.popover.toggle(event);
  }

  protected readonly visibleActions = computed<readonly QuickAction[]>(() =>
    this.config().actions.filter((a) => this.isAllowed(a.permission)),
  );

  private isAllowed(permission: QuickAction['permission']): boolean {
    if (!permission) return true;
    if (permission.roles?.length && !this.auth.hasAnyRole(...permission.roles)) {
      return false;
    }
    if (permission.requiredPolicy && !this.auth.hasAnyPermission(permission.requiredPolicy)) {
      return false;
    }
    return true;
  }

  protected onPick(action: QuickAction): void {
    this.popover.hide();
    this.action.emit({
      source: 'quickAction',
      actionKey: action.actionKey,
      payload: { id: action.id },
    });
  }
}
