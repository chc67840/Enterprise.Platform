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
  styleUrl: './avatar.component.scss',
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
