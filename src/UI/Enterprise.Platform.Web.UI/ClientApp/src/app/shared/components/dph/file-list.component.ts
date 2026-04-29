/**
 * ─── DPH UI KIT — FILE LIST ─────────────────────────────────────────────────────
 *
 * Read-only or interactive file list rendering FileItem[]. Used inside
 * dph-file-upload AND standalone for displaying attachments.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { FileItem } from './dph.types';

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function humanSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

function iconFor(mime: string): string {
  if (mime.startsWith('image/')) return 'pi pi-image';
  if (mime.startsWith('video/')) return 'pi pi-video';
  if (mime.startsWith('audio/')) return 'pi pi-volume-up';
  if (mime === 'application/pdf') return 'pi pi-file-pdf';
  if (mime.includes('spreadsheet') || mime.includes('csv') || mime.includes('excel')) return 'pi pi-file-excel';
  if (mime.includes('word') || mime.includes('document')) return 'pi pi-file-word';
  if (mime.includes('zip') || mime.includes('compressed')) return 'pi pi-box';
  return 'pi pi-file';
}

@Component({
  selector: 'dph-file-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (files().length === 0) {
      @if (emptyMessage()) {
        <p class="dph-fl__empty">{{ emptyMessage() }}</p>
      }
    } @else {
      <ul class="dph-fl" role="list">
        @for (f of files(); track f.id) {
          <li class="dph-fl__row" [attr.data-status]="f.status">
            @if (f.previewUrl) {
              <img class="dph-fl__thumb" [src]="f.previewUrl" alt="" />
            } @else {
              <i class="dph-fl__icon" [class]="iconFor(f.type)" aria-hidden="true"></i>
            }
            <div class="dph-fl__info">
              <div class="dph-fl__name">{{ f.name }}</div>
              <div class="dph-fl__meta">
                <span>{{ humanSize(f.size) }}</span>
                @if (f.status === 'uploading' && f.uploadProgress !== undefined) {
                  <span>· {{ f.uploadProgress }}%</span>
                }
                @if (f.status === 'error') {
                  <span class="dph-fl__error">· {{ f.error || 'Upload failed' }}</span>
                }
              </div>
              @if (f.status === 'uploading' && f.uploadProgress !== undefined) {
                <div class="dph-fl__progress" role="progressbar" [attr.aria-valuenow]="f.uploadProgress" aria-valuemin="0" aria-valuemax="100">
                  <span [style.width.%]="f.uploadProgress"></span>
                </div>
              }
            </div>
            @if (showRemove()) {
              <button
                type="button"
                class="dph-fl__remove"
                [attr.aria-label]="'Remove ' + f.name"
                (click)="remove.emit(f)"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './file-list.component.scss',
})
export class FileListComponent {
  readonly files = input<readonly FileItem[]>([]);
  readonly showRemove = input<boolean>(true);
  readonly emptyMessage = input<string>('');
  readonly remove = output<FileItem>();

  protected readonly humanSize = humanSize;
  protected readonly iconFor = iconFor;
}
