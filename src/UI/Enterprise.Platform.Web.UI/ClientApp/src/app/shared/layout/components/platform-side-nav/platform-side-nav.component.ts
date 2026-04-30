/**
 * Generic config-driven side rail. Same `NavMenuConfig` literal that powers
 * the horizontal navbar centre zone; the variant flips the surface.
 *
 * Two visual states (driven by `effectiveCollapsed`):
 *   - expanded — full label + icon; parent items expand an inline accordion.
 *   - collapsed — icons-only rail; parent items open a `<p-popover>` flyout.
 *
 * Mobile (≤768px) is a fundamentally different surface: the rail leaves the
 * document flow and slides in as a left-anchored drawer with a backdrop.
 * In drawer mode `effectiveCollapsed` is forced false so labels always show.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  input,
  output,
  signal,
  type QueryList,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { type Popover, PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

/**
 * PrimeNG v21's Popover doesn't surface `container` on its public types but
 * exposes the rendered overlay element on the instance after `show()`. We
 * read it to position the popover programmatically.
 */
type PopoverWithContainer = Popover & { readonly container: HTMLElement | null };

import { AuthStore } from '@core/auth';
import { SidenavStateService } from '../../services/sidenav-state.service';
import type {
  NavActionEvent,
  NavMenuConfig,
  NavMenuItem,
  NavMenuLeaf,
  NavMenuSection,
  NavPermission,
} from '../../models/nav.models';

@Component({
  selector: 'app-platform-side-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive, PopoverModule, TooltipModule],
  template: `
    @if (mobileOpen()) {
      <div
        class="ep-side-nav__backdrop"
        aria-hidden="true"
        (click)="onBackdropClick()"
      ></div>
    }

    <aside
      #asideRef
      id="ep-platform-sidenav"
      class="ep-side-nav"
      [class.ep-side-nav--collapsed]="effectiveCollapsed()"
      [class.ep-side-nav--mobile-open]="mobileOpen()"
      role="navigation"
      [attr.aria-label]="ariaLabel()"
    >
      <!--
        Collapse / expand toggle anchored to the rail itself. Lives outside
        the menubar list so screen readers don't announce it as a menu
        item. Click delegates to SidenavStateService.toggle — same signal
        any other surface reads (the hamburger position can move freely
        without touching shared state).
      -->
      <button
        type="button"
        class="ep-side-nav__toggle"
        [attr.aria-expanded]="!collapsed()"
        aria-controls="ep-platform-sidenav"
        [attr.aria-label]="collapsed() ? 'Expand navigation' : 'Collapse navigation'"
        [pTooltip]="collapsed() ? 'Expand navigation' : 'Collapse navigation'"
        tooltipPosition="right"
        (click)="onToggleClick($event)"
      >
        <i class="pi pi-bars" aria-hidden="true"></i>
        @if (!collapsed()) {
          <span class="ep-side-nav__toggle-label">Collapse</span>
        }
      </button>

      <ul class="ep-side-nav__list" role="menu">
        @for (item of visibleItems(); track item.id) {
          <li
            class="ep-side-nav__li"
            [class.ep-side-nav__li--has-children]="hasChildren(item)"
            [class.ep-side-nav__li--expanded]="isAccordionOpen(item)"
          >
            <!-- ═══════════ Top-level row ═══════════ -->
            @if (hasChildren(item)) {
              <!--
                EXPANDED → accordion header (button toggling the inline panel).
                COLLAPSED → flyout trigger (button toggling the side popover).
                One <button> handles both because the only behavioural
                difference is which target it toggles; aria attrs flip
                accordingly so screen readers announce the right pattern.
              -->
              <button
                #parentBtn
                type="button"
                class="ep-side-nav__row ep-side-nav__row--button"
                [attr.aria-expanded]="effectiveCollapsed() ? null : isAccordionOpen(item)"
                [attr.aria-haspopup]="effectiveCollapsed() ? 'menu' : null"
                [attr.aria-controls]="effectiveCollapsed() ? null : panelIdFor(item)"
                [pTooltip]="effectiveCollapsed() ? item.label : (item.tooltip ?? undefined)"
                tooltipPosition="right"
                (click)="onParentClick(item, parentBtn, $event)"
              >
                @if (item.icon) {
                  <i class="ep-side-nav__icon" [ngClass]="item.icon" aria-hidden="true"></i>
                } @else {
                  <span class="ep-side-nav__icon ep-side-nav__icon--placeholder" aria-hidden="true">
                    {{ item.label.charAt(0) }}
                  </span>
                }

                @if (!effectiveCollapsed()) {
                  <span class="ep-side-nav__label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="ep-side-nav__badge" [attr.data-variant]="item.badge.variant">
                      {{ item.badge.value }}
                    </span>
                  }
                  <i
                    class="pi pi-chevron-down ep-side-nav__chevron"
                    [class.ep-side-nav__chevron--open]="isAccordionOpen(item)"
                    aria-hidden="true"
                  ></i>
                }
              </button>

              <!-- ── COLLAPSED → flyout popover ──────────────────────── -->
              @if (effectiveCollapsed()) {
                <p-popover
                  #flyout
                  appendTo="body"
                  [styleClass]="flyoutStyleClass(item)"
                  (onShow)="onFlyoutShow(flyout)"
                >
                  <div
                    class="ep-side-nav__flyout-content"
                    [class.ep-side-nav__flyout-content--multi-section]="flyoutLayoutMode(item) === 'multi-section'"
                    [class.ep-side-nav__flyout-content--split-single]="flyoutLayoutMode(item) === 'split-single'"
                    [style.--section-count]="item.children!.length"
                  >
                    <div class="ep-side-nav__flyout-header">
                      @if (item.icon) {
                        <i [ngClass]="item.icon" aria-hidden="true"></i>
                      }
                      <span class="ep-side-nav__flyout-title">{{ item.label }}</span>
                    </div>
                    <div class="ep-side-nav__flyout-sections">
                      @for (section of item.children!; track section.heading) {
                        <div class="ep-side-nav__flyout-section">
                          <h3 class="ep-side-nav__flyout-heading">{{ section.heading }}</h3>
                          @if (section.subheading) {
                            <p class="ep-side-nav__flyout-sub">{{ section.subheading }}</p>
                          }
                          <ul role="list" class="ep-side-nav__flyout-list">
                            @for (leaf of section.leaves; track leaf.id) {
                              @if (leafAllowed(leaf)) {
                                <li>
                                  <ng-container *ngTemplateOutlet="leafTpl; context: { $implicit: leaf, isFlyout: true }"></ng-container>
                                </li>
                              }
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  </div>
                </p-popover>
              }
            } @else {
              <!-- Leaf top-level item (no children) — direct link. -->
              @if (item.externalUrl) {
                <a
                  [href]="item.externalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ep-side-nav__row"
                  [pTooltip]="effectiveCollapsed() ? item.label : (item.tooltip ?? undefined)"
                  tooltipPosition="right"
                  role="menuitem"
                  [attr.aria-label]="ariaLabelFor(item)"
                  (click)="trackLinkClick(item)"
                >
                  @if (item.icon) {
                    <i class="ep-side-nav__icon" [ngClass]="item.icon" aria-hidden="true"></i>
                  } @else {
                    <span class="ep-side-nav__icon ep-side-nav__icon--placeholder" aria-hidden="true">
                      {{ item.label.charAt(0) }}
                    </span>
                  }
                  @if (!effectiveCollapsed()) {
                    <span class="ep-side-nav__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-side-nav__badge" [attr.data-variant]="item.badge.variant">
                        {{ item.badge.value }}
                      </span>
                    }
                  }
                </a>
              } @else {
                <a
                  [routerLink]="item.routePath"
                  [routerLinkActiveOptions]="activeOptions()"
                  routerLinkActive="ep-side-nav__row--active"
                  #rla="routerLinkActive"
                  class="ep-side-nav__row"
                  [pTooltip]="effectiveCollapsed() ? item.label : (item.tooltip ?? undefined)"
                  tooltipPosition="right"
                  role="menuitem"
                  [attr.aria-label]="ariaLabelFor(item)"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  (click)="trackLinkClick(item)"
                >
                  @if (item.icon) {
                    <i class="ep-side-nav__icon" [ngClass]="item.icon" aria-hidden="true"></i>
                  } @else {
                    <span class="ep-side-nav__icon ep-side-nav__icon--placeholder" aria-hidden="true">
                      {{ item.label.charAt(0) }}
                    </span>
                  }
                  @if (!effectiveCollapsed()) {
                    <span class="ep-side-nav__label">{{ item.label }}</span>
                    @if (item.badge) {
                      <span class="ep-side-nav__badge" [attr.data-variant]="item.badge.variant">
                        {{ item.badge.value }}
                      </span>
                    }
                  }
                </a>
              }
            }

            <!-- ═══════════ EXPANDED accordion panel ═══════════ -->
            @if (hasChildren(item) && !effectiveCollapsed() && isAccordionOpen(item)) {
              <div
                [id]="panelIdFor(item)"
                class="ep-side-nav__accordion"
                role="group"
                [attr.aria-label]="item.label + ' submenu'"
              >
                @for (section of item.children!; track section.heading; let sectionIdx = $index) {
                  @if (sectionIdx > 0 || item.children!.length > 1) {
                    <p class="ep-side-nav__accordion-heading">{{ section.heading }}</p>
                  }
                  <ul role="list" class="ep-side-nav__accordion-list">
                    @for (leaf of section.leaves; track leaf.id) {
                      @if (leafAllowed(leaf)) {
                        <li>
                          <ng-container *ngTemplateOutlet="leafTpl; context: { $implicit: leaf, isFlyout: false }"></ng-container>
                        </li>
                      }
                    }
                  </ul>
                }
              </div>
            }
          </li>
        }
      </ul>
    </aside>

    <!-- ═══════════ Shared leaf template (accordion + flyout) ═══════════ -->
    <ng-template #leafTpl let-leaf let-isFlyout="isFlyout">
      @if (leaf.externalUrl) {
        <a
          [href]="leaf.externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="ep-side-nav__leaf"
          [class.ep-side-nav__leaf--in-flyout]="isFlyout"
          (click)="onLeafClick(leaf, isFlyout)"
        >
          @if (leaf.icon) {
            <i [ngClass]="leaf.icon" class="ep-side-nav__leaf-icon" aria-hidden="true"></i>
          }
          <span class="ep-side-nav__leaf-text">
            <span class="ep-side-nav__leaf-label">{{ leaf.label }}</span>
            @if (leaf.description && isFlyout) {
              <span class="ep-side-nav__leaf-desc">{{ leaf.description }}</span>
            }
          </span>
        </a>
      } @else {
        <a
          [routerLink]="leaf.routePath"
          class="ep-side-nav__leaf"
          [class.ep-side-nav__leaf--in-flyout]="isFlyout"
          routerLinkActive="ep-side-nav__leaf--active"
          (click)="onLeafClick(leaf, isFlyout)"
        >
          @if (leaf.icon) {
            <i [ngClass]="leaf.icon" class="ep-side-nav__leaf-icon" aria-hidden="true"></i>
          }
          <span class="ep-side-nav__leaf-text">
            <span class="ep-side-nav__leaf-label">{{ leaf.label }}</span>
            @if (leaf.description && isFlyout) {
              <span class="ep-side-nav__leaf-desc">{{ leaf.description }}</span>
            }
          </span>
        </a>
      }
    </ng-template>
  `,
  styleUrl: './platform-side-nav.component.scss',
})
export class PlatformSideNavComponent {
  private readonly auth = inject(AuthStore);
  private readonly state = inject(SidenavStateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── inputs / outputs ─────────────────────────────────────────────────────

  /** Centre-zone menu config — same shape consumed by `<app-nav-menu>`. */
  readonly config = input.required<NavMenuConfig>();

  /** Custom aria-label override; defaults to "Primary navigation". */
  readonly ariaLabel = input<string>('Primary navigation');

  /** Bubbled nav events (analytics tags + leaf selections). */
  readonly action = output<NavActionEvent>();

  // ── shared state ─────────────────────────────────────────────────────────

  protected readonly collapsed = this.state.collapsed;
  protected readonly mobileOpen = this.state.mobileOpen;

  /**
   * Display-state flag — does the rail render in icons-only / flyout mode?
   *
   * The drawer pattern on mobile is fundamentally a different surface from
   * the desktop collapse. When the drawer is open we want full labels +
   * accordion behaviour regardless of the persisted desktop preference;
   * the user shouldn't have to expand the rail before they can read it.
   *
   * `mobileOpen()` is only ever truthy on a mobile-width viewport (the
   * service guards the toggle behind matchMedia), so this expression
   * collapses to:
   *   - desktop: `collapsed()` (persisted preference)
   *   - mobile drawer open: false (always-expanded labels)
   *
   * Used everywhere visual state matters; the underlying `collapsed`
   * signal is preserved so the desktop preference round-trips correctly.
   */
  protected readonly effectiveCollapsed = computed(
    () => this.collapsed() && !this.mobileOpen(),
  );

  /** Which accordion sections are currently open (expanded mode only). */
  private readonly openAccordions = signal<ReadonlySet<string>>(new Set());

  /** Popover refs are in 1:1 order with `itemsWithChildren()`. */
  @ViewChildren('flyout') protected readonly flyouts!: QueryList<Popover>;

  /** Outer aside element — used to measure the rail's right edge so the
   *  flyout popover never overlaps the sidebar regardless of viewport. */
  @ViewChild('asideRef') private readonly asideRef?: ElementRef<HTMLElement>;

  /**
   * Currently active trigger button — set in `onParentClick` and read by
   * `onFlyoutShow` to anchor the arrow vertically. Cleared on hide.
   */
  private activeTrigger: HTMLButtonElement | null = null;

  constructor() {
    // Auto-close mobile drawer on route change so tapping a nav item
    // doesn't leave the drawer + backdrop covering the destination page.
    this.router.events
      .pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.state.closeMobile());
  }

  // ── derived signals ──────────────────────────────────────────────────────

  protected readonly visibleItems = computed<readonly NavMenuItem[]>(() =>
    this.config().items.filter((it) => this.permissionAllowed(it.permission)),
  );

  /**
   * Items rendering a `<p-popover #flyout>` block — all visible items with
   * children (flyout is conditional on `collapsed()` but the QueryList stays
   * in sync because both the conditional and the children check live in
   * the same template branch).
   */
  protected readonly itemsWithChildren = computed<readonly NavMenuItem[]>(() =>
    this.visibleItems().filter((it) => this.hasChildren(it)),
  );

  protected readonly activeOptions = computed(() => {
    switch (this.config().activeMatchStrategy) {
      case 'exact': return { exact: true };
      default:      return { exact: false };
    }
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  protected hasChildren(item: NavMenuItem): item is NavMenuItem & { children: readonly NavMenuSection[] } {
    return !!(item.children && item.children.length > 0);
  }

  /**
   * Threshold above which the flyout grows from a narrow single-column
   * panel into a multi-column wide panel. Counts ALLOWED leaves only —
   * permission-gated leaves should not bloat the layout.
   */
  private static readonly FLYOUT_GRID_THRESHOLD = 5;

  /**
   * Decides which CSS layout the flyout uses for `item`. Three modes:
   *
   *   • 'single'        — total leaves ≤ 5 → narrow stack (current behaviour)
   *   • 'multi-section' — leaves > 5 AND >1 sections → CSS grid, one column
   *                       per section (mirrors the horizontal mega-menu).
   *   • 'split-single'  — leaves > 5 AND only 1 section → split that section
   *                       into 2 CSS columns so the popover stays wide and
   *                       balanced rather than tall and narrow.
   *
   * The decision is permission-aware: gated leaves don't push the flyout
   * past the threshold, so a hidden item never causes a layout shift.
   */
  protected flyoutLayoutMode(item: NavMenuItem): 'single' | 'multi-section' | 'split-single' {
    if (!this.hasChildren(item)) return 'single';
    const allowedLeafCount = item.children.reduce(
      (sum, section) => sum + section.leaves.filter((l) => this.leafAllowed(l)).length,
      0,
    );
    if (allowedLeafCount <= PlatformSideNavComponent.FLYOUT_GRID_THRESHOLD) return 'single';
    return item.children.length > 1 ? 'multi-section' : 'split-single';
  }

  /**
   * Composite styleClass passed to the popover. The base class drives the
   * panel chrome + arrow; the mode class is also surfaced on the body-
   * appended popover root so global rules (which can't reach the inner
   * div via component-scoped CSS) can adjust width / padding.
   */
  protected flyoutStyleClass(item: NavMenuItem): string {
    const mode = this.flyoutLayoutMode(item);
    return mode === 'single'
      ? 'ep-side-nav__flyout'
      : `ep-side-nav__flyout ep-side-nav__flyout--${mode}`;
  }

  protected ariaLabelFor(item: NavMenuItem): string {
    const badge = item.badge?.value;
    return badge ? `${item.label}, ${badge}` : item.label;
  }

  protected panelIdFor(item: NavMenuItem): string {
    return `ep-side-nav__panel-${item.id}`;
  }

  protected isAccordionOpen(item: NavMenuItem): boolean {
    return this.openAccordions().has(item.id);
  }

  protected leafAllowed(leaf: NavMenuLeaf): boolean {
    return this.permissionAllowed(leaf.permission);
  }

  private permissionAllowed(permission: NavPermission | undefined): boolean {
    if (!permission) return true;
    if (permission.roles?.length && !this.auth.hasAnyRole(...permission.roles)) {
      return false;
    }
    if (permission.requiredPolicy && !this.auth.hasAnyPermission(permission.requiredPolicy)) {
      return false;
    }
    return true;
  }

  // ── event handlers ───────────────────────────────────────────────────────

  /**
   * Single click handler for parent rows. Dispatches to either:
   *   - flyout popover (collapsed)
   *   - accordion toggle (expanded)
   *
   * stopPropagation matters here — PrimeNG's Popover registers a global
   * outside-click listener while open. Without stopPropagation, the same
   * click that opens the popover can be re-interpreted as "click outside"
   * by a stale listener and immediately close it (the classic "two-click
   * to open" bug). Same rationale as `NavMenuComponent.toggleOverlay`.
   *
   * `triggerButton` is captured so `onFlyoutShow` can compute the arrow's
   * vertical anchor relative to the popover's final position.
   */
  protected onParentClick(item: NavMenuItem, triggerButton: HTMLButtonElement, event: MouseEvent): void {
    event.stopPropagation();
    if (this.effectiveCollapsed()) {
      this.activeTrigger = triggerButton;
      this.toggleFlyout(item, event);
    } else {
      this.toggleAccordion(item);
    }
  }

  /**
   * Position the body-appended popover programmatically so it never
   * overlaps the rail or the navbar, and align the left arrow to the
   * trigger's vertical centre via `--ep-flyout-arrow-top`.
   *
   * PrimeNG v21's `onShow` emits void; the overlay element lives on the
   * Popover instance, which is why we pass the template ref instead of
   * `$event`. CSS alone can't do this — PrimeNG anchors the popover
   * inside the rail, so we read `aside.right` and re-pin from there.
   */
  protected onFlyoutShow(popover: Popover): void {
    const overlay = (popover as PopoverWithContainer).container;
    if (!overlay || !this.asideRef) return;

    const ARROW_GAP_PX = 12;
    const TOP_GAP_PX = 8;
    const ARROW_HALF_HEIGHT = 7;

    const aside = this.asideRef.nativeElement.getBoundingClientRect();
    overlay.style.left = `${aside.right + ARROW_GAP_PX}px`;

    const minTop = this.readNavHeightPx() + TOP_GAP_PX;
    const currentTop = parseFloat(overlay.style.top || '0') || overlay.getBoundingClientRect().top;
    if (currentTop < minTop) {
      overlay.style.top = `${minTop}px`;
    }

    const trigger = this.activeTrigger;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const triggerCentreY = triggerRect.top + triggerRect.height / 2;
    const arrowTop = triggerCentreY - overlayRect.top - ARROW_HALF_HEIGHT;
    const maxArrowTop = Math.max(8, overlayRect.height - 16);
    overlay.style.setProperty(
      '--ep-flyout-arrow-top',
      `${Math.min(Math.max(8, arrowTop), maxArrowTop)}px`,
    );
  }

  /** Reads `--nav-height` from `:root`. Mirrors the SCSS 64px fallback. */
  private readNavHeightPx(): number {
    if (typeof window === 'undefined') return 64;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim();
    const num = parseFloat(raw);
    return Number.isFinite(num) ? num : 64;
  }

  /** Backdrop click on mobile — dismisses the drawer. */
  protected onBackdropClick(): void {
    this.state.closeMobile();
  }

  /**
   * Document-level Escape — close the mobile drawer if open. Mirrors the
   * navbar's drawer affordance so keyboard users never get stuck inside a
   * modal-like surface (WCAG 2.1.2).
   */
  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.mobileOpen()) {
      this.state.closeMobile();
    }
  }

  /**
   * Sidebar's own collapse toggle — flips the shared
   * `SidenavStateService.collapsed` signal. Stop-propagation guards
   * against any open popover/flyout from interpreting the same click as
   * an outside-click and double-handling.
   */
  protected onToggleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.state.toggle();
  }

  protected onLeafClick(leaf: NavMenuLeaf, isFlyout: boolean): void {
    if (isFlyout) {
      // Close every flyout once a leaf is selected — the navigation about
      // to commit will hide the surface anyway, but explicit close avoids
      // the popover lingering during the route transition.
      this.flyouts.forEach((p) => p.hide());
    }
    if (leaf.analyticsTag) {
      this.action.emit({
        source: 'menu',
        actionKey: leaf.analyticsTag,
        payload: { id: leaf.id },
      });
    }
  }

  protected trackLinkClick(item: NavMenuItem): void {
    if (item.analyticsTag) {
      this.action.emit({
        source: 'menu',
        actionKey: item.analyticsTag,
        payload: { id: item.id },
      });
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private toggleFlyout(item: NavMenuItem, event: MouseEvent): void {
    const idx = this.itemsWithChildren().findIndex((it) => it.id === item.id);
    if (idx < 0) return;
    const panel = this.flyouts.toArray()[idx];
    panel?.toggle(event);
  }

  private toggleAccordion(item: NavMenuItem): void {
    this.openAccordions.update((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }
}
