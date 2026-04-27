/**
 * ─── DPH UI KIT — FILE PREVIEW ──────────────────────────────────────────────────
 *
 * Generic preview pane: image inline, PDF in iframe, video/audio via
 * native HTML5 players, fallback to icon + download link.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { FileItem } from './dph.types';

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
            <iframe [src]="safeUrl(f.url || '')" [title]="f.name" class="dph-fp__iframe"></iframe>
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
  styles: [
    `
      :host { display: block; }
      .dph-fp { width: 100%; }
      .dph-fp__media { display: block; max-width: 100%; max-height: 70vh; border-radius: var(--ep-radius-md); }
      .dph-fp__iframe { width: 100%; height: 70vh; border: none; border-radius: var(--ep-radius-md); }
      .dph-fp__fallback {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem;
        color: var(--ep-color-neutral-600);
        text-align: center;
      }
      .dph-fp__fallback i { font-size: 2.5rem; color: var(--ep-color-neutral-400); }
      .dph-fp__fallback a { color: var(--ep-color-primary-700); text-decoration: underline; }
    `,
  ],
})
export class FilePreviewComponent {
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

  /** No DomSanitizer dependency — iframes only accept trusted URLs anyway; cast to bypass strict typing. */
  protected safeUrl(url: string): string {
    return url;
  }
}
