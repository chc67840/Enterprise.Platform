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
  styles: [
    `
      :host { display: block; }
      .dph-fl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.375rem; }
      .dph-fl__row {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--ep-color-neutral-200);
        border-radius: var(--ep-radius-md);
        background-color: #ffffff;
      }
      .dph-fl__row[data-status='error'] { border-color: var(--ep-color-danger-300, var(--ep-color-danger-500)); background-color: var(--ep-color-danger-50); }
      .dph-fl__row[data-status='complete'] { border-color: var(--ep-color-palmetto-200); }

      .dph-fl__thumb { width: 2.5rem; height: 2.5rem; border-radius: var(--ep-radius-sm); object-fit: cover; flex-shrink: 0; }
      .dph-fl__icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; font-size: 1.25rem; border-radius: var(--ep-radius-sm); background-color: var(--ep-color-neutral-100); color: var(--ep-color-neutral-700); flex-shrink: 0; }

      .dph-fl__info { flex: 1; min-width: 0; }
      .dph-fl__name { font-size: 0.875rem; font-weight: 500; color: var(--ep-color-neutral-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dph-fl__meta { font-size: 0.75rem; color: var(--ep-color-neutral-500); display: flex; gap: 0.25rem; }
      .dph-fl__error { color: var(--ep-color-danger-700); }

      .dph-fl__progress {
        margin-top: 0.25rem;
        height: 4px;
        border-radius: 9999px;
        background-color: var(--ep-color-neutral-100);
        overflow: hidden;
      }
      .dph-fl__progress > span {
        display: block;
        height: 100%;
        background-color: var(--ep-color-primary-600);
        transition: width 200ms ease;
      }

      .dph-fl__remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--ep-radius-md);
        background-color: transparent;
        color: var(--ep-color-neutral-500);
        border: none;
        cursor: pointer;
        flex-shrink: 0;
      }
      .dph-fl__remove:hover { background-color: var(--ep-color-neutral-100); color: var(--ep-color-danger-700); }
      .dph-fl__remove:focus-visible { outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px; }
      .dph-fl__remove i { pointer-events: none; }

      .dph-fl__empty {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--ep-color-neutral-500);
        font-style: italic;
      }
    `,
  ],
})
export class FileListComponent {
  readonly files = input<readonly FileItem[]>([]);
  readonly showRemove = input<boolean>(true);
  readonly emptyMessage = input<string>('');
  readonly remove = output<FileItem>();

  protected readonly humanSize = humanSize;
  protected readonly iconFor = iconFor;
}
