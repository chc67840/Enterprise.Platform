/**
 * ─── DPH UI KIT — AVATAR ────────────────────────────────────────────────────────
 *
 * Image / initials / icon fallback chain. Sizes xs–2xl. Optional badge in
 * any corner.
 *
 *   <dph-avatar [config]="{ src: u.avatarUrl, name: u.displayName, size: 'md' }" />
 *   <dph-avatar [config]="{ name: 'Jane Doe', size: 'lg', badge: { value: '3', severity: 'danger' } }" />
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { toInitials } from '@utils';

import type { AvatarConfig } from './dph.types';

@Component({
  selector: 'dph-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="dph-avatar"
      [attr.data-size]="config().size || 'md'"
      [attr.data-shape]="config().shape || 'circle'"
      [style.--dph-avatar-bg]="config().bgColor || null"
      [style.--dph-avatar-fg]="config().textColor || null"
    >
      @if (config().src && !imgError()) {
        <img
          [src]="config().src"
          [alt]="config().name || ''"
          (error)="imgError.set(true)"
          loading="lazy"
        />
      } @else if (config().icon) {
        <i [class]="config().icon" aria-hidden="true"></i>
      } @else {
        <span class="dph-avatar__text" aria-hidden="true">{{ initials() }}</span>
        <span class="dph-sr-only">{{ config().name || 'Avatar' }}</span>
      }
      @if (config().badge) {
        <span class="dph-avatar__badge" [attr.data-pos]="config().badge!.position || 'topright'" [attr.data-severity]="config().badge!.severity || 'danger'">
          @if (config().badge!.value) { {{ config().badge!.value }} }
        </span>
      }
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .dph-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

      .dph-avatar {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 9999px;
        background-color: var(--dph-avatar-bg, var(--ep-color-primary-100));
        color: var(--dph-avatar-fg, var(--ep-color-primary-800));
        font-weight: 600;
        font-size: 0.875rem;
        line-height: 1;
        flex-shrink: 0;
        overflow: hidden;
      }
      .dph-avatar[data-shape='square'] { border-radius: var(--ep-radius-md); }

      .dph-avatar[data-size='xs'] { width: 1.5rem; height: 1.5rem; font-size: 0.625rem; }
      .dph-avatar[data-size='sm'] { width: 2rem; height: 2rem; font-size: 0.75rem; }
      .dph-avatar[data-size='md'] { /* default */ }
      .dph-avatar[data-size='lg'] { width: 3rem; height: 3rem; font-size: 1rem; }
      .dph-avatar[data-size='xl'] { width: 3.5rem; height: 3.5rem; font-size: 1.125rem; }
      .dph-avatar[data-size='2xl'] { width: 4rem; height: 4rem; font-size: 1.25rem; }

      .dph-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .dph-avatar i { font-size: 1.125rem; }
      .dph-avatar__text { user-select: none; pointer-events: none; }

      .dph-avatar__badge {
        position: absolute;
        min-width: 1rem;
        height: 1rem;
        padding: 0 0.25rem;
        border-radius: 9999px;
        background-color: var(--ep-color-danger-600);
        color: #ffffff;
        font-size: 0.625rem;
        font-weight: 700;
        line-height: 1rem;
        text-align: center;
        border: 2px solid #ffffff;
      }
      .dph-avatar__badge[data-severity='success'] { background-color: var(--ep-color-palmetto-600); }
      .dph-avatar__badge[data-severity='warning'] { background-color: var(--ep-color-jessamine-500); color: var(--ep-color-primary-900); }
      .dph-avatar__badge[data-severity='info'] { background-color: var(--ep-color-primary-600); }
      .dph-avatar__badge[data-severity='neutral'] { background-color: var(--ep-color-neutral-500); }
      .dph-avatar__badge[data-pos='topright'] { top: -0.125rem; right: -0.125rem; }
      .dph-avatar__badge[data-pos='topleft'] { top: -0.125rem; left: -0.125rem; }
      .dph-avatar__badge[data-pos='bottomright'] { bottom: -0.125rem; right: -0.125rem; }
      .dph-avatar__badge[data-pos='bottomleft'] { bottom: -0.125rem; left: -0.125rem; }
    `,
  ],
})
export class AvatarComponent {
  readonly config = input.required<AvatarConfig>();
  protected readonly imgError = signal<boolean>(false);

  protected readonly initials = computed(() => {
    const c = this.config();
    if (c.label) return c.label;
    if (c.name) return toInitials(c.name);
    return '?';
  });
}
