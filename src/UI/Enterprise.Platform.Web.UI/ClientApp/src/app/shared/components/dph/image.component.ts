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
  styles: [
    `
      :host { display: inline-block; }
      .dph-image {
        position: relative;
        display: inline-block;
        overflow: hidden;
      }
      .dph-image[data-rounded='md'] { border-radius: var(--ep-radius-md); }
      .dph-image[data-rounded='full'] { border-radius: 9999px; }

      .dph-image[data-aspect='1/1'] { aspect-ratio: 1 / 1; width: 100%; }
      .dph-image[data-aspect='4/3'] { aspect-ratio: 4 / 3; width: 100%; }
      .dph-image[data-aspect='16/9'] { aspect-ratio: 16 / 9; width: 100%; }
      .dph-image[data-aspect='3/2'] { aspect-ratio: 3 / 2; width: 100%; }

      .dph-image img {
        display: block;
        width: 100%;
        height: 100%;
      }

      .dph-image__skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, var(--ep-color-neutral-200), var(--ep-color-neutral-100), var(--ep-color-neutral-200));
        background-size: 200% 100%;
        animation: dph-img-shimmer 1.4s ease infinite;
        z-index: 1;
      }
      @keyframes dph-img-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dph-image__skeleton { animation: none; }
      }
    `,
  ],
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
