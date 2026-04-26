/**
 * ─── shared/layout/components/nav-menu ──────────────────────────────────────────
 *
 * F.4 — single component, four variants. Replaces the F.2 baseline (which
 * delegated to PrimeNG Menubar and flattened mega-menu sections).
 *
 * Variants (driven by `config.variant`):
 *   - 'flat' → horizontal list of links + dropdown groups
 *   - 'tabs' → horizontal links with bottom-border active indicator
 *   - 'icon' → icon-only buttons with pTooltip showing label
 *   - 'mega' → groups open OverlayPanel with section grid (one column per section)
 *
 * Layout (`'horizontal' | 'vertical'`) is independent of variant — the mobile
 * overlay uses 'flat' + 'vertical' to render a top-to-bottom drawer.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ViewChildren,
  type QueryList,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { type Popover, PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

import { AuthStore } from '@core/auth';
import type {
  NavActionEvent,
  NavMenuConfig,
  NavMenuItem,
  NavMenuLeaf,
} from '@shared/layout';

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, PopoverModule, TooltipModule],
  template: `
    <nav
      class="ep-nav-menu"
      [class.ep-nav-menu--flat]="config().variant === 'flat'"
      [class.ep-nav-menu--tabs]="config().variant === 'tabs'"
      [class.ep-nav-menu--icon]="config().variant === 'icon'"
      [class.ep-nav-menu--mega]="config().variant === 'mega'"
      [class.ep-nav-menu--horizontal]="layout() === 'horizontal'"
      [class.ep-nav-menu--vertical]="layout() === 'vertical'"
      [class.ep-nav-menu--dark]="tone() === 'dark'"
      [class.ep-nav-menu--light]="tone() === 'light'"
    >
      <ul class="ep-nav-menu__list" role="list">
        @for (item of visibleItems(); track item.id) {
          <li class="ep-nav-menu__li">
            @if (item.children && item.children.length > 0) {
              <button
                type="button"
                class="ep-nav-menu__link"
                [disabled]="item.disabled"
                [pTooltip]="config().variant === 'icon' ? item.label : (item.tooltip ?? undefined)"
                tooltipPosition="bottom"
                aria-haspopup="true"
                (click)="toggleOverlay(item.id, $event)"
              >
                @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                @if (config().variant !== 'icon') {
                  <span class="ep-nav-menu__label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="ep-nav-menu__badge" [attr.data-variant]="item.badge.variant">
                      {{ item.badge.value }}
                    </span>
                  }
                  <i class="pi pi-chevron-down ep-nav-menu__chevron text-[10px]" aria-hidden="true"></i>
                }
              </button>

              <p-popover
                #overlay
                [styleClass]="config().variant === 'mega' ? 'ep-nav-menu__mega' : 'ep-nav-menu__dropdown'"
              >
                @if (config().variant === 'mega') {
                  <div class="ep-nav-menu__sections" [style.--section-count]="item.children!.length">
                    @for (section of item.children!; track section.heading) {
                      <div class="ep-nav-menu__section">
                        <h3 class="ep-nav-menu__section-heading">{{ section.heading }}</h3>
                        @if (section.subheading) {
                          <p class="ep-nav-menu__section-sub">{{ section.subheading }}</p>
                        }
                        <ul role="list" class="ep-nav-menu__section-list">
                          @for (leaf of section.leaves; track leaf.id) {
                            @if (leafAllowed(leaf)) {
                              <li>
                                @if (leaf.externalUrl) {
                                  <a
                                    [href]="leaf.externalUrl"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="ep-nav-menu__leaf"
                                    (click)="trackLeafClick(leaf)"
                                  >
                                    @if (leaf.icon) { <i [class]="leaf.icon" aria-hidden="true"></i> }
                                    <span>
                                      <span class="ep-nav-menu__leaf-label">{{ leaf.label }}</span>
                                      @if (leaf.description) {
                                        <span class="ep-nav-menu__leaf-desc">{{ leaf.description }}</span>
                                      }
                                    </span>
                                  </a>
                                } @else {
                                  <a
                                    [routerLink]="leaf.routePath"
                                    class="ep-nav-menu__leaf"
                                    routerLinkActive="ep-nav-menu__leaf--active"
                                    (click)="onLeafSelected(leaf)"
                                  >
                                    @if (leaf.icon) { <i [class]="leaf.icon" aria-hidden="true"></i> }
                                    <span>
                                      <span class="ep-nav-menu__leaf-label">{{ leaf.label }}</span>
                                      @if (leaf.description) {
                                        <span class="ep-nav-menu__leaf-desc">{{ leaf.description }}</span>
                                      }
                                    </span>
                                  </a>
                                }
                              </li>
                            }
                          }
                        </ul>
                      </div>
                    }
                  </div>
                } @else {
                  <ul role="list" class="ep-nav-menu__dropdown-list">
                    @for (section of item.children!; track section.heading; let sectionIdx = $index) {
                      @if (sectionIdx > 0) {
                        <li class="ep-nav-menu__dropdown-divider" aria-hidden="true"></li>
                      }
                      @if (item.children!.length > 1) {
                        <li class="ep-nav-menu__dropdown-heading">{{ section.heading }}</li>
                      }
                      @for (leaf of section.leaves; track leaf.id) {
                        @if (leafAllowed(leaf)) {
                          <li>
                            @if (leaf.externalUrl) {
                              <a
                                [href]="leaf.externalUrl"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="ep-nav-menu__dropdown-link"
                                (click)="trackLeafClick(leaf)"
                              >
                                @if (leaf.icon) { <i [class]="leaf.icon" aria-hidden="true"></i> }
                                <span>{{ leaf.label }}</span>
                              </a>
                            } @else {
                              <a
                                [routerLink]="leaf.routePath"
                                class="ep-nav-menu__dropdown-link"
                                routerLinkActive="ep-nav-menu__dropdown-link--active"
                                (click)="onLeafSelected(leaf)"
                              >
                                @if (leaf.icon) { <i [class]="leaf.icon" aria-hidden="true"></i> }
                                <span>{{ leaf.label }}</span>
                              </a>
                            }
                          </li>
                        }
                      }
                    }
                  </ul>
                }
              </p-popover>
            } @else {
              @if (item.externalUrl) {
                <a
                  [href]="item.externalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ep-nav-menu__link"
                  [class.ep-nav-menu__link--disabled]="item.disabled"
                  [pTooltip]="config().variant === 'icon' ? item.label : (item.tooltip ?? undefined)"
                  tooltipPosition="bottom"
                  (click)="trackLinkClick(item)"
                >
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  @if (config().variant !== 'icon') {
                    <span class="ep-nav-menu__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-nav-menu__badge" [attr.data-variant]="item.badge.variant">
                        {{ item.badge.value }}
                      </span>
                    }
                  }
                </a>
              } @else {
                <a
                  [routerLink]="item.routePath"
                  [routerLinkActiveOptions]="activeOptions()"
                  routerLinkActive="ep-nav-menu__item--active"
                  class="ep-nav-menu__link"
                  [class.ep-nav-menu__link--disabled]="item.disabled"
                  [pTooltip]="config().variant === 'icon' ? item.label : (item.tooltip ?? undefined)"
                  tooltipPosition="bottom"
                  (click)="onLinkSelected(item)"
                >
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  @if (config().variant !== 'icon') {
                    <span class="ep-nav-menu__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-nav-menu__badge" [attr.data-variant]="item.badge.variant">
                        {{ item.badge.value }}
                      </span>
                    }
                  }
                </a>
              }
            }
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
      }
      .ep-nav-menu {
        display: flex;
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
      }

      .ep-nav-menu__list {
        display: flex;
        align-items: stretch;
        gap: 0.125rem;
        margin: 0;
        padding: 0;
        list-style: none;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;          /* Firefox */
      }
      .ep-nav-menu__list::-webkit-scrollbar { display: none; }   /* WebKit */
      .ep-nav-menu--vertical .ep-nav-menu__list {
        flex-direction: column;
        gap: 0;
        overflow-x: visible;
        overflow-y: auto;
      }

      .ep-nav-menu__li { position: relative; display: flex; flex-shrink: 0; }

      /*
       * Padding tightened from 0.875rem → 0.625rem so 5–7 items fit on a
       * 1280-wide laptop without the centre menu pushing into the right zone.
       */
      .ep-nav-menu__link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.625rem;
        border-radius: 0.375rem;
        background: transparent;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: none;
        transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
        cursor: pointer;
        border: none;
        white-space: nowrap;
      }
      .ep-nav-menu__link--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
      .ep-nav-menu__chevron { opacity: 0.7; }
      .ep-nav-menu__label { line-height: 1; }

      /* tone: dark */
      .ep-nav-menu--dark .ep-nav-menu__link { color: rgba(255, 255, 255, 0.92); }
      .ep-nav-menu--dark .ep-nav-menu__link:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .ep-nav-menu--dark .ep-nav-menu__item--active {
        background-color: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        box-shadow: inset 0 -2px 0 0 var(--ep-color-jessamine-500);
      }
      .ep-nav-menu--dark .ep-nav-menu__link:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }

      /* tone: light (mobile drawer) */
      .ep-nav-menu--light .ep-nav-menu__link {
        color: var(--ep-color-neutral-800);
        width: 100%;
        padding: 0.75rem 1rem;
        justify-content: flex-start;
      }
      .ep-nav-menu--light .ep-nav-menu__link:hover { background-color: var(--ep-color-primary-50); }
      .ep-nav-menu--light .ep-nav-menu__item--active {
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-800);
        box-shadow: inset 3px 0 0 0 var(--ep-color-jessamine-500);
      }

      /* variant: tabs */
      .ep-nav-menu--tabs .ep-nav-menu__item--active {
        background-color: transparent;
        box-shadow: inset 0 -3px 0 0 var(--ep-color-jessamine-500);
      }

      /* variant: icon */
      .ep-nav-menu--icon .ep-nav-menu__link {
        width: 2.5rem;
        height: 2.5rem;
        padding: 0;
        justify-content: center;
        font-size: 1.125rem;
      }

      /* badges */
      .ep-nav-menu__badge {
        display: inline-flex;
        align-items: center;
        padding: 0 0.5rem;
        height: 1.125rem;
        border-radius: 9999px;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ep-nav-menu__badge[data-variant='info'] { background-color: var(--ep-color-primary-500); color: #fff; }
      .ep-nav-menu__badge[data-variant='success'] { background-color: var(--ep-color-palmetto-500); color: #fff; }
      .ep-nav-menu__badge[data-variant='warning'] { background-color: var(--ep-color-jessamine-500); color: var(--ep-color-primary-900); }
      .ep-nav-menu__badge[data-variant='danger'] { background-color: var(--ep-color-danger-600, #dc2626); color: #fff; }
      .ep-nav-menu__badge[data-variant='secondary'] { background-color: var(--ep-color-neutral-300); color: var(--ep-color-neutral-800); }

      /* flat dropdown panel */
      :host ::ng-deep .ep-nav-menu__dropdown { min-width: 14rem; padding: 0.25rem; }
      .ep-nav-menu__dropdown-list { list-style: none; padding: 0; margin: 0; }
      .ep-nav-menu__dropdown-heading {
        padding: 0.5rem 0.75rem 0.25rem;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ep-color-neutral-500);
      }
      .ep-nav-menu__dropdown-divider {
        height: 1px;
        background-color: var(--ep-color-neutral-200);
        margin: 0.25rem 0;
      }
      .ep-nav-menu__dropdown-link {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        color: var(--ep-color-neutral-800);
        font-size: 0.875rem;
        text-decoration: none;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-nav-menu__dropdown-link:hover {
        background-color: var(--ep-color-primary-50);
        color: var(--ep-color-primary-800);
      }
      .ep-nav-menu__dropdown-link--active {
        background-color: var(--ep-color-primary-100);
        color: var(--ep-color-primary-900);
      }
      .ep-nav-menu__dropdown-link:focus-visible {
        outline: 2px solid var(--ep-color-primary-500);
        outline-offset: -2px;
      }

      /* mega panel */
      :host ::ng-deep .ep-nav-menu__mega {
        min-width: clamp(28rem, 48vw, 42rem);
        padding: 1rem 1.25rem;
      }
      .ep-nav-menu__sections {
        --section-count: 2;
        display: grid;
        grid-template-columns: repeat(var(--section-count), minmax(0, 1fr));
        gap: 1.25rem;
      }
      @media (max-width: 768px) { .ep-nav-menu__sections { grid-template-columns: 1fr; } }
      .ep-nav-menu__section-heading {
        margin: 0 0 0.25rem;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ep-color-neutral-500);
      }
      .ep-nav-menu__section-sub {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
      }
      .ep-nav-menu__section-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.125rem; }
      .ep-nav-menu__leaf {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        padding: 0.5rem 0.625rem;
        border-radius: 0.375rem;
        color: var(--ep-color-neutral-800);
        font-size: 0.875rem;
        text-decoration: none;
        transition: background-color 120ms ease, color 120ms ease;
      }
      .ep-nav-menu__leaf:hover { background-color: var(--ep-color-primary-50); }
      .ep-nav-menu__leaf--active { background-color: var(--ep-color-primary-100); color: var(--ep-color-primary-900); }
      .ep-nav-menu__leaf:focus-visible {
        outline: 2px solid var(--ep-color-primary-500);
        outline-offset: -2px;
      }
      .ep-nav-menu__leaf > i { color: var(--ep-color-primary-700); margin-top: 0.125rem; }
      .ep-nav-menu__leaf-label { display: block; font-weight: 500; line-height: 1.2; }
      .ep-nav-menu__leaf-desc {
        display: block;
        margin-top: 0.125rem;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
      }

      @media (prefers-reduced-motion: reduce) {
        .ep-nav-menu__link,
        .ep-nav-menu__dropdown-link,
        .ep-nav-menu__leaf {
          transition: none;
        }
      }
    `,
  ],
})
export class NavMenuComponent {
  private readonly auth = inject(AuthStore);

  readonly config = input.required<NavMenuConfig>();
  readonly tone = input<'light' | 'dark'>('dark');
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');

  readonly action = output<NavActionEvent>();

  /** All registered overlay panels — addressable by the visible-item index. */
  @ViewChildren('overlay') protected readonly overlays!: QueryList<Popover>;

  protected readonly visibleItems = computed<readonly NavMenuItem[]>(() =>
    this.config().items.filter((it) => this.itemAllowed(it)),
  );

  protected readonly activeOptions = computed(() => {
    switch (this.config().activeMatchStrategy) {
      case 'exact': return { exact: true };
      default: return { exact: false };
    }
  });

  // ── permission gating (fail-open) ──────────────────────────────────────

  private itemAllowed(item: NavMenuItem): boolean {
    return this.permissionAllowed(item.permission);
  }

  protected leafAllowed(leaf: NavMenuLeaf): boolean {
    return this.permissionAllowed(leaf.permission);
  }

  private permissionAllowed(permission: NavMenuItem['permission']): boolean {
    if (!permission) return true;
    if (permission.roles?.length && !this.auth.hasAnyRole(...permission.roles)) {
      return false;
    }
    if (permission.requiredPolicy && !this.auth.hasAnyPermission(permission.requiredPolicy)) {
      return false;
    }
    return true;
  }

  // ── overlay + click handling ───────────────────────────────────────────

  protected toggleOverlay(itemId: string, event: MouseEvent): void {
    const idx = this.visibleItems().findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const panel = this.overlays.toArray()[idx];
    panel?.toggle(event);
  }

  protected onLinkSelected(item: NavMenuItem): void {
    if (item.analyticsTag) {
      this.action.emit({ source: 'menu', actionKey: item.analyticsTag, payload: { id: item.id } });
    }
  }

  protected onLeafSelected(leaf: NavMenuLeaf): void {
    this.overlays.forEach((p) => p.hide());
    if (leaf.analyticsTag) {
      this.action.emit({ source: 'menu', actionKey: leaf.analyticsTag, payload: { id: leaf.id } });
    }
  }

  protected trackLinkClick(item: NavMenuItem): void {
    if (item.analyticsTag) {
      this.action.emit({ source: 'menu', actionKey: item.analyticsTag, payload: { id: item.id } });
    }
  }

  protected trackLeafClick(leaf: NavMenuLeaf): void {
    if (leaf.analyticsTag) {
      this.action.emit({ source: 'menu', actionKey: leaf.analyticsTag, payload: { id: leaf.id } });
    }
  }
}
