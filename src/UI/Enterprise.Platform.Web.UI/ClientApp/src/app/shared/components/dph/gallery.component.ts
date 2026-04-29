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
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent {
  readonly config = input.required<GalleryConfig>();
}
