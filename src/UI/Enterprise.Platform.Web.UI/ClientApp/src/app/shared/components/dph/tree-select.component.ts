/**
 * ─── DPH UI KIT — TREE SELECT ───────────────────────────────────────────────────
 *
 * Hierarchical pick. Wraps `<dph-tree>` (which itself wraps PrimeNG `<p-tree>`)
 * with field-shaped configuration (label / hint / required / errors) and
 * surfaces the selected node's `key` (or array of keys for multi-select)
 * as the bound model.
 *
 *   <dph-tree-select
 *     [(value)]="permissionKey"
 *     [config]="{
 *       label: 'Permission',
 *       nodes: permissionsTree(),
 *       selectionMode: 'single',
 *       required: true,
 *     }"
 *   />
 *
 * VALUE SHAPE
 *   - `selectionMode: 'single'`              → bound value is a single `key` (string).
 *   - `selectionMode: 'multiple' | 'checkbox'` → bound value is `readonly string[]`.
 *
 *   The value is NEVER the whole TreeNode — keeps the form payload primitive
 *   and aligned with `dph-select` / `dph-autocomplete`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { generateUuid } from '@utils';

import { FieldErrorComponent } from './field-error.component';
import { TreeComponent } from './tree.component';
import type { Size, TreeConfig, TreeNode } from './dph.types';

export interface TreeSelectFieldConfig<T = unknown> {
  readonly label?: string;
  readonly hint?: string;
  readonly nodes: readonly TreeNode<T>[];
  readonly selectionMode?: 'single' | 'multiple' | 'checkbox';
  /** Full TreeConfig override — beats per-field props above. */
  readonly treeConfig?: TreeConfig<T>;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  readonly size?: Size;
  readonly invalid?: boolean;
  readonly errors?: readonly string[];
  readonly id?: string;
  readonly name?: string;
}

@Component({
  selector: 'dph-tree-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TreeComponent, FieldErrorComponent],
  template: `
    <div class="dph-tree-select" [attr.data-size]="config().size || 'md'">
      @if (config().label) {
        <label [for]="inputId()" class="dph-tree-select__label">
          {{ config().label }}
          @if (config().required) {
            <span class="dph-tree-select__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div
        class="dph-tree-select__panel"
        [attr.data-invalid]="invalidEffective() ? 'true' : null"
        [attr.id]="inputId()"
        [attr.aria-required]="config().required ? 'true' : null"
        [attr.aria-invalid]="invalidEffective() ? 'true' : null"
        [attr.aria-describedby]="errorId()"
      >
        <dph-tree
          [config]="effectiveTreeConfig()"
          [nodes]="config().nodes"
          [selection]="boundSelection()"
          (selectionChange)="onSelectionChange($any($event))"
        />
      </div>

      @if (config().hint && !invalidEffective()) {
        <p class="dph-tree-select__hint">{{ config().hint }}</p>
      }

      <dph-field-error [errors]="config().errors || []" [id]="errorId()" />
    </div>
  `,
  styleUrl: './tree-select.component.scss',
})
export class TreeSelectComponent<T = unknown> {
  readonly config = input.required<TreeSelectFieldConfig<T>>();
  /** Single mode: `string | null`. Multi/checkbox: `readonly string[]`. */
  readonly value = model<string | readonly string[] | null>(null);
  readonly blur = output<void>();
  readonly focus = output<void>();

  private readonly _autoId = signal<string>(`dph-tree-${generateUuid().slice(0, 8)}`);
  protected readonly inputId = computed(() => this.config().id || this._autoId());
  protected readonly errorId = computed(() => `${this.inputId()}-error`);
  protected readonly invalidEffective = computed(
    () => !!this.config().invalid || (this.config().errors?.length ?? 0) > 0,
  );

  protected readonly effectiveTreeConfig = computed<TreeConfig<T>>(() => {
    const override = this.config().treeConfig;
    if (override) return override;
    return {
      selectionMode: this.config().selectionMode ?? 'single',
      filter: false,
    };
  });

  /** Index nodes by key — drives both seed lookup and value→node round-trip. */
  private readonly nodeIndex = computed<ReadonlyMap<string, TreeNode<T>>>(() => {
    const map = new Map<string, TreeNode<T>>();
    const walk = (list: readonly TreeNode<T>[]) => {
      for (const n of list) {
        map.set(n.key, n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(this.config().nodes);
    return map;
  });

  protected readonly boundSelection = computed<TreeNode<T> | TreeNode<T>[] | null>(() => {
    const v = this.value();
    const idx = this.nodeIndex();
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) {
      return v.map((k) => idx.get(k)).filter((n): n is TreeNode<T> => !!n);
    }
    if (typeof v === 'string') {
      return idx.get(v) ?? null;
    }
    return null;
  });

  protected onSelectionChange(sel: TreeNode<T> | TreeNode<T>[] | null): void {
    if (sel === null || sel === undefined) {
      this.value.set(this.config().selectionMode === 'single' ? null : []);
      return;
    }
    if (Array.isArray(sel)) {
      this.value.set(sel.map((n) => n.key));
      return;
    }
    this.value.set(sel.key);
  }
}
