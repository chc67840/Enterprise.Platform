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
    <!--
      Outer is <div role="presentation"> not <nav>. The parent
      <app-platform-navbar> already exposes the single navigation landmark
      (<nav role="navigation" aria-label="Primary">). A nested <nav> would
      announce a duplicate landmark to screen readers (WCAG 1.3.1) and is
      the source of "two navbar trees" structural bugs.
    -->
    <div
      role="presentation"
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
      <ul class="ep-nav-menu__list" role="menubar">
        @for (item of visibleItems(); track item.id) {
          <li class="ep-nav-menu__li">
            @if (item.children && item.children.length > 0) {
              <button
                type="button"
                class="ep-nav-menu__link"
                [disabled]="item.disabled"
                [pTooltip]="config().variant === 'icon' ? item.label : (item.tooltip ?? undefined)"
                tooltipPosition="bottom"
                aria-haspopup="menu"
                role="menuitem"
                [attr.aria-label]="ariaLabelFor(item)"
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
                appendTo="body"
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
                  role="menuitem"
                  [attr.aria-label]="ariaLabelFor(item) + ' (opens in a new tab)'"
                  (click)="trackLinkClick(item)"
                >
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  @if (config().variant !== 'icon') {
                    <span class="ep-nav-menu__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-nav-menu__badge" [attr.data-variant]="item.badge.variant" aria-hidden="true">
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
                  #rla="routerLinkActive"
                  class="ep-nav-menu__link"
                  [class.ep-nav-menu__link--disabled]="item.disabled"
                  [pTooltip]="config().variant === 'icon' ? item.label : (item.tooltip ?? undefined)"
                  tooltipPosition="bottom"
                  role="menuitem"
                  [attr.aria-label]="ariaLabelFor(item)"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  (click)="onLinkSelected(item)"
                >
                  @if (item.icon) { <i [class]="item.icon" aria-hidden="true"></i> }
                  @if (config().variant !== 'icon') {
                    <span class="ep-nav-menu__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-nav-menu__badge" [attr.data-variant]="item.badge.variant" aria-hidden="true">
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
    </div>
  `,
  styleUrl: './nav-menu.component.scss',
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

  /**
   * Items that render a `<p-popover #overlay>` block — i.e. visible items
   * with at least one child section. The template only emits a popover
   * inside `@if (item.children && item.children.length > 0)`, so the
   * `@ViewChildren('overlay')` QueryList is in 1:1 order with this subset.
   *
   * Using a separate selector (rather than indexing into `visibleItems`)
   * fixes the idx-mismatch bug where leaf-only items earlier in the menu
   * shifted the count and caused parent items further down to fail to
   * open their dropdown (UI Demo silently no-op'd until this fix).
   */
  protected readonly itemsWithOverlays = computed<readonly NavMenuItem[]>(() =>
    this.visibleItems().filter((it) => !!(it.children && it.children.length > 0)),
  );

  /**
   * Builds the explicit `aria-label` for a nav item. Robust against template
   * restructuring (icons, badges, nested spans don't fragment the computed
   * accessible name) and gives automation a stable handle by which to find
   * the item: `getByRole('menuitem', { name: 'Signals, LIVE' })` works
   * regardless of how the visual chrome is assembled.
   */
  protected ariaLabelFor(item: NavMenuItem): string {
    const badge = item.badge?.value;
    return badge ? `${item.label}, ${badge}` : item.label;
  }

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
    /*
     * stopPropagation is critical: PrimeNG's Popover registers a global
     * outside-click listener while open. If a previous popover left a stale
     * listener attached, the SAME click that opens this panel can be
     * intercepted as "outside" and immediately close it — net result is the
     * mega-menu-needs-two-clicks bug. Stopping propagation scopes the
     * trigger click to this button.
     */
    event.stopPropagation();
    const idx = this.itemsWithOverlays().findIndex((it) => it.id === itemId);
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
