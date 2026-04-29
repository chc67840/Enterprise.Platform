/**
 * ─── DPH UI KIT — FILE PREVIEW ──────────────────────────────────────────────────
 *
 * Generic preview pane: image inline, PDF in iframe, video/audio via
 * native HTML5 players, fallback to icon + download link.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

import type { FileItem } from './dph.types';

const ALLOWED_PDF_SCHEMES = ['http:', 'https:', 'blob:'] as const;
const ALLOWED_PDF_DATA_PREFIX = 'data:application/pdf';

@Component({
  selector: 'dph-file-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (file(); as f) {
      <div class="dph-fp">
        @switch (kind()) {
          @case ('image') {
            <img [src]="f.url || f.previewUrl" [alt]="f.name" class="dph-fp__media" />
          }
          @case ('pdf') {
            @if (pdfSrc(); as src) {
              <iframe [src]="src" [title]="f.name" class="dph-fp__iframe"></iframe>
            } @else {
              <div class="dph-fp__fallback">
                <i class="pi pi-file" aria-hidden="true"></i>
                <p>{{ f.name }}</p>
              </div>
            }
          }
          @case ('video') {
            <video [src]="f.url" controls class="dph-fp__media"></video>
          }
          @case ('audio') {
            <audio [src]="f.url" controls></audio>
          }
          @default {
            <div class="dph-fp__fallback">
              <i class="pi pi-file" aria-hidden="true"></i>
              <p>{{ f.name }}</p>
              @if (f.url) {
                <a [href]="f.url" download>Download</a>
              }
            </div>
          }
        }
      </div>
    }
  `,
  styleUrl: './file-preview.component.scss',
})
export class FilePreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly file = input<FileItem | null>(null);

  protected readonly kind = computed<'image' | 'pdf' | 'video' | 'audio' | 'other'>(() => {
    const f = this.file();
    if (!f) return 'other';
    if (f.type.startsWith('image/')) return 'image';
    if (f.type === 'application/pdf') return 'pdf';
    if (f.type.startsWith('video/')) return 'video';
    if (f.type.startsWith('audio/')) return 'audio';
    return 'other';
  });

  /**
   * Iframe `[src]` is a resource-URL context — Angular rejects raw strings
   * (NG0904). We only bypass after allow-listing the scheme so a hostile
   * `javascript:` / `vbscript:` URL planted in `FileItem.url` cannot reach
   * the DOM.
   */
  protected readonly pdfSrc = computed<SafeResourceUrl | null>(() => {
    const url = this.file()?.url;
    if (!url) return null;
    if (!this.isSafePdfUrl(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  private isSafePdfUrl(url: string): boolean {
    if (url.startsWith(ALLOWED_PDF_DATA_PREFIX)) return true;
    try {
      const parsed = new URL(url, window.location.origin);
      return (ALLOWED_PDF_SCHEMES as readonly string[]).includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}
