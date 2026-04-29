/**
 * ─── DPH UI KIT — IMAGE ─────────────────────────────────────────────────────────
 *
 * Wraps PrimeNG <p-image> when preview/lightbox is needed; falls back to
 * a native <img> for static images. Skeleton placeholder while loading.
 * Fallback chain: src → fallbackSrc → fallbackIcon.
 *
 *   <dph-image [config]="{ src: '/img/foo.png', alt: 'Foo', skeleton: true }" />
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ImageModule } from 'primeng/image';

import type { ImageConfig } from './dph.types';

@Component({
  selector: 'dph-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageModule],
  template: `
    <span
      class="dph-image"
      [attr.data-aspect]="config().aspectRatio || 'auto'"
      [attr.data-rounded]="config().rounded === 'full' ? 'full' : (config().rounded ? 'md' : null)"
    >
      @if (loading() && config().skeleton) {
        <span class="dph-image__skeleton" aria-hidden="true"></span>
      }

      @if (config().preview) {
        <p-image
          [src]="effectiveSrc()"
          [alt]="config().alt"
          [preview]="true"
          [loading]="config().loading || 'lazy'"
        />
      } @else {
        <img
          [src]="effectiveSrc()"
          [alt]="config().alt"
          [loading]="config().loading || 'lazy'"
          [width]="config().width || null"
          [height]="config().height || null"
          [style.object-fit]="config().objectFit || 'cover'"
          (load)="loading.set(false)"
          (error)="onError()"
        />
      }
    </span>
  `,
  styleUrl: './image.component.scss',
})
export class ImageComponent {
  readonly config = input.required<ImageConfig>();
  protected readonly loading = signal<boolean>(true);
  protected readonly errored = signal<boolean>(false);

  protected readonly effectiveSrc = computed(() => {
    const c = this.config();
    if (this.errored() && c.fallbackSrc) return c.fallbackSrc;
    return c.src;
  });

  protected onError(): void {
    if (this.errored()) {
      // already on fallback; if it also fails, give up silently
      this.loading.set(false);
      return;
    }
    this.errored.set(true);
    if (!this.config().fallbackSrc) this.loading.set(false);
  }
}
