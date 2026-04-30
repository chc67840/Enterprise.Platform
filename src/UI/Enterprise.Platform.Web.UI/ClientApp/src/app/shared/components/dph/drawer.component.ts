/**
 * ─── DPH UI KIT — DRAWER ────────────────────────────────────────────────────────
 *
 * Side / edge-anchored slide-in panel. Wraps PrimeNG Drawer (formerly Sidebar)
 * with the safe defaults we always want and a named-slot footer for sticky
 * action bars.
 *
 * USAGE (P1.2 — size preset)
 *
 *   <dph-drawer
 *     [(visible)]="filterPanelOpen"
 *     [config]="{ position: 'right', size: 'lg', header: 'Filters' }">
 *
 *     <!-- default slot — body content -->
 *     <app-filter-form />
 *
 *     <!-- named slot — sticky footer (action bar) -->
 *     <div drawerFooter>
 *       <dph-button variant="ghost" label="Reset" />
 *       <dph-button variant="primary" label="Apply" />
 *     </div>
 *   </dph-drawer>
 *
 * SIZES
 *   `size: 'sm' | 'md' | 'lg' | 'xl' | 'full'`
 *   For `left|right` drawers, size maps to width (320 / 480 / 640 / 960 / 100vw).
 *   For `top|bottom` drawers, size maps to height (320 / 480 / 640 / 960 / 100vh).
 *
 *   Direct `width` / `height` props in config still win — the size preset is
 *   the convenience path; one-offs can pass any CSS length.
 *
 * FOOTER
 *   Project content with `<div drawerFooter>...</div>` (or any element with the
 *   `drawerFooter` attribute). Renders pinned to the bottom of the panel with
 *   a separator above by default. Toggle via `config.footerDivider: false`.
 *
 *   The footer shell is always present in the DOM but uses CSS `:empty` to
 *   hide itself when nothing is projected — drawers without a footer collapse
 *   the footer area so body fills the panel.
 *
 * FOCUS / A11Y
 *   PrimeNG's drawer ships:
 *     - `role="dialog"` + `aria-modal="true"` while open
 *     - Focus trap inside the panel
 *     - Esc closes (toggleable via `closeOnEscape`)
 *
 * MIGRATION FROM PRE-P1.2
 *   The old `width: 'min(360px, 90vw)'` direct-CSS pattern still works.
 *   New code SHOULD prefer `size: 'md'` for consistency across the kit.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { DrawerModule } from 'primeng/drawer';

import type { DrawerConfig, DrawerSize } from './dph.types';

/** Width/height in pixels keyed by the named size preset. */
const SIZE_PX: Readonly<Record<Exclude<DrawerSize, 'full'>, number>> = {
  sm: 320,
  md: 480,
  lg: 640,
  xl: 960,
};

/**
 * Resolves a `DrawerConfig` to the inline `style` object the PrimeNG drawer
 * panel needs (either `{ width: ... }` or `{ height: ... }` based on the
 * drawer's anchor edge).
 *
 * EXPORTED so it can be unit-tested without bootstrapping Angular's TestBed
 * (the component proper depends on `styleUrl` which jsdom-mode tests can't
 * resolve cheaply). Tests in `drawer.component.spec.ts` invoke this function
 * directly on a plain config object.
 *
 * RESOLUTION PRECEDENCE (highest first)
 *   1. `config.width` (left/right) or `config.height` (top/bottom) — direct
 *      CSS escape hatch.
 *   2. `config.size === 'full'` → 100vw / 100vh.
 *   3. `config.size` named preset → `min({px}, {clamp})`.
 *   4. Legacy default — `min(320px, 85vw)` for left/right,
 *      `min(360px, 70vh)` for top/bottom.
 */
export function resolveDrawerDimension(config: DrawerConfig): Record<string, string> {
  const isHorizontal = config.position === 'left' || config.position === 'right';
  const out: Record<string, string> = {};

  if (isHorizontal) {
    if (config.width) {
      out['width'] = config.width;
    } else if (config.size === 'full') {
      out['width'] = '100vw';
    } else if (config.size) {
      out['width'] = `min(${SIZE_PX[config.size]}px, 92vw)`;
    } else {
      out['width'] = 'min(320px, 85vw)';
    }
  } else {
    if (config.height) {
      out['height'] = config.height;
    } else if (config.size === 'full') {
      out['height'] = '100vh';
    } else if (config.size) {
      out['height'] = `min(${SIZE_PX[config.size]}px, 80vh)`;
    } else {
      out['height'] = 'min(360px, 70vh)';
    }
  }

  return out;
}

@Component({
  selector: 'dph-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DrawerModule],
  template: `
    <p-drawer
      [(visible)]="visible"
      [position]="config().position"
      [modal]="config().modal ?? true"
      [dismissible]="config().dismissableMask ?? true"
      [closeOnEscape]="config().closeOnEscape ?? true"
      [showCloseIcon]="config().closable ?? true"
      [header]="config().header || ''"
      appendTo="body"
      [style]="drawerStyle()"
      styleClass="dph-drawer"
      (onHide)="onHide()"
    >
      @if (config().subheader) {
        <p class="dph-drawer__subheader">{{ config().subheader }}</p>
      }

      <div class="dph-drawer__body">
        <ng-content />
      </div>

      <footer
        class="dph-drawer__footer"
        [class.dph-drawer__footer--no-divider]="config().footerDivider === false"
      >
        <ng-content select="[drawerFooter]" />
      </footer>
    </p-drawer>
  `,
  styleUrl: './drawer.component.scss',
})
export class DrawerComponent {
  readonly config = input.required<DrawerConfig>();
  readonly visible = model<boolean>(false);
  readonly closed = output<void>();

  /** Reactive view of `resolveDrawerDimension` — driven by the config signal. */
  protected readonly drawerStyle = computed<Record<string, string>>(() =>
    resolveDrawerDimension(this.config()),
  );

  protected onHide(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
