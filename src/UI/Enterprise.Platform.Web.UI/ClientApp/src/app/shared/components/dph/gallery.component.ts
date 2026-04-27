/**
 * ─── DPH UI KIT — GALLERY ───────────────────────────────────────────────────────
 *
 * Responsive image grid with optional lightbox. Columns collapse: requested
 * count on lg+, half on md, 2 on sm, 1 on xs.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ImageComponent } from './image.component';
import type { GalleryConfig } from './dph.types';

@Component({
  selector: 'dph-gallery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageComponent],
  template: `
    <ul
      class="dph-gallery"
      role="list"
      [attr.data-cols]="config().columns ?? 3"
      [attr.data-aspect]="config().aspect ?? '1/1'"
      [attr.data-gap]="config().gap ?? 'md'"
    >
      @for (item of config().items; track item.src) {
        <li class="dph-gallery__item" role="listitem">
          <dph-image
            [config]="{
              src: item.src,
              alt: item.alt,
              aspectRatio: config().aspect ?? '1/1',
              skeleton: true,
              preview: !!config().lightbox,
              loading: config().lazy ? 'lazy' : 'eager',
            }"
          />
          @if (item.caption) {
            <p class="dph-gallery__caption">{{ item.caption }}</p>
          }
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host { display: block; }
      .dph-gallery {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr;
      }
      .dph-gallery[data-gap='xs'] { gap: 0.25rem; }
      .dph-gallery[data-gap='sm'] { gap: 0.5rem; }
      .dph-gallery[data-gap='lg'] { gap: 1rem; }
      .dph-gallery[data-gap='xl'] { gap: 1.5rem; }

      @media (min-width: 480px) {
        .dph-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (min-width: 768px) {
        .dph-gallery[data-cols='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dph-gallery[data-cols='3'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dph-gallery[data-cols='4'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dph-gallery[data-cols='5'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (min-width: 1024px) {
        .dph-gallery[data-cols='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .dph-gallery[data-cols='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .dph-gallery[data-cols='5'] { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      }

      .dph-gallery__item { display: flex; flex-direction: column; gap: 0.25rem; }
      .dph-gallery__caption {
        margin: 0;
        font-size: 0.75rem;
        color: var(--ep-color-neutral-600);
        text-align: center;
      }
    `,
  ],
})
export class GalleryComponent {
  readonly config = input.required<GalleryConfig>();
}
