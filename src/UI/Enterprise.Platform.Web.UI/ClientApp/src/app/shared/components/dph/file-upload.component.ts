/**
 * ─── DPH UI KIT — FILE UPLOAD ───────────────────────────────────────────────────
 *
 * Three variants:
 *   - dropzone  — large drop area + "browse" link
 *   - button    — inline "Upload" button
 *   - inline    — file input rendered as a row
 *
 * Validates accept / maxFileSize / maxFiles / minFileSize before emitting.
 * Custom upload mode (the default) emits selected files to the parent;
 * the parent owns the actual HTTP upload + progress reporting back via
 * the two-way `files` model.
 */
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { generateUuid } from '@utils';

import { ButtonComponent } from './button.component';
import { FileListComponent } from './file-list.component';
import type { FileItem, FileUploadConfig } from './dph.types';

@Component({
  selector: 'dph-file-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent, FileListComponent],
  template: `
    @switch (config().variant) {
      @case ('dropzone') {
        <div
          class="dph-fu__zone"
          [class.dph-fu__zone--drag]="dragActive()"
          [class.dph-fu__zone--disabled]="!!config().disabled"
          role="button"
          tabindex="0"
          [attr.aria-label]="config().label || 'Drop files here or click to upload'"
          (click)="openPicker()"
          (keydown.enter)="openPicker()"
          (keydown.space)="$event.preventDefault(); openPicker()"
          (dragenter)="onDragEnter($event)"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          <i [class]="config().icon || 'pi pi-cloud-upload'" class="dph-fu__icon" aria-hidden="true"></i>
          <p class="dph-fu__title">{{ config().label || 'Drop files here' }}</p>
          @if (config().hint) {
            <p class="dph-fu__hint">{{ config().hint }}</p>
          }
          <p class="dph-fu__hint dph-fu__hint--muted">
            or <span class="dph-fu__link">browse</span>
          </p>
          @if (limitsHint()) {
            <p class="dph-fu__hint dph-fu__hint--muted">{{ limitsHint() }}</p>
          }
        </div>
      }
      @case ('button') {
        <dph-button
          [label]="config().label || 'Upload'"
          [icon]="config().icon || 'pi pi-upload'"
          variant="secondary"
          [disabled]="!!config().disabled"
          (clicked)="openPicker()"
        />
      }
      @default {
        <input
          type="file"
          class="dph-fu__inline"
          [accept]="config().accept || ''"
          [multiple]="!!config().multiple"
          [disabled]="!!config().disabled"
          (change)="onPickerChange($event)"
        />
      }
    }

    <input
      #picker
      type="file"
      hidden
      [accept]="config().accept || ''"
      [multiple]="!!config().multiple"
      (change)="onPickerChange($event)"
    />

    @if (config().showFileList !== false && files().length > 0) {
      <dph-file-list
        class="dph-fu__list"
        [files]="files()"
        (remove)="onRemove($event)"
      />
    }
  `,
  styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent {
  readonly config = input.required<FileUploadConfig>();
  readonly files = model<FileItem[]>([]);

  readonly filesSelected = output<File[]>();
  readonly fileRemoved = output<FileItem>();
  readonly uploadError = output<{ file: FileItem; error: string }>();

  @ViewChild('picker') picker!: ElementRef<HTMLInputElement>;

  protected readonly dragActive = signal<boolean>(false);

  protected readonly limitsHint = computed(() => {
    const c = this.config();
    const parts: string[] = [];
    if (c.accept) parts.push(`accepts ${c.accept}`);
    if (c.maxFileSize) parts.push(`up to ${(c.maxFileSize / (1024 * 1024)).toFixed(1)} MB each`);
    if (c.maxFiles) parts.push(`max ${c.maxFiles} file${c.maxFiles === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : '';
  });

  protected openPicker(): void {
    if (this.config().disabled) return;
    this.picker.nativeElement.click();
  }

  protected onPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }
  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }
  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }
  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    if (this.config().disabled) return;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    this.handleFiles(dropped);
  }

  protected onRemove(file: FileItem): void {
    this.files.set(this.files().filter((f) => f.id !== file.id));
    this.fileRemoved.emit(file);
  }

  private handleFiles(incoming: File[]): void {
    const valid: File[] = [];
    const c = this.config();

    for (const f of incoming) {
      if (c.maxFileSize && f.size > c.maxFileSize) {
        this.uploadError.emit({
          file: this.toItem(f, 'error', `File exceeds ${(c.maxFileSize / (1024 * 1024)).toFixed(1)} MB limit`),
          error: 'File too large',
        });
        continue;
      }
      if (c.minFileSize && f.size < c.minFileSize) {
        this.uploadError.emit({
          file: this.toItem(f, 'error', `File smaller than ${c.minFileSize} bytes`),
          error: 'File too small',
        });
        continue;
      }
      valid.push(f);
    }

    if (c.maxFiles) {
      const remaining = c.maxFiles - this.files().length;
      if (remaining <= 0) return;
      valid.splice(remaining);
    }

    if (valid.length === 0) return;

    const newItems: FileItem[] = valid.map((f) =>
      this.toItem(f, c.autoUpload ? 'uploading' : 'pending'),
    );
    this.files.set([...this.files(), ...newItems]);
    this.filesSelected.emit(valid);
  }

  private toItem(file: File, status: FileItem['status'], error?: string): FileItem {
    return {
      id: generateUuid(),
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status,
      error,
    };
  }
}
