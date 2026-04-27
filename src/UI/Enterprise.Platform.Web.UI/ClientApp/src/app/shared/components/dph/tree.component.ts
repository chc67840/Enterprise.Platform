/**
 * ─── DPH UI KIT — TREE ──────────────────────────────────────────────────────────
 *
 * Wraps PrimeNG <p-tree> with our standard config + accessibility defaults.
 * Supports single, multiple, and checkbox selection. Lazy loading via
 * (lazyLoad) emit when a node with `leaf: false` and empty children
 * expands.
 *
 *   <dph-tree
 *     [config]="{ selectionMode: 'checkbox', filter: true }"
 *     [nodes]="permissionsTree()"
 *     [(selection)]="selectedNodes"
 *   />
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TreeModule } from 'primeng/tree';
import type { TreeNode as PrimeTreeNode } from 'primeng/api';

import type { TreeConfig, TreeNode } from './dph.types';

@Component({
  selector: 'dph-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TreeModule],
  template: `
    <p-tree
      [value]="primeNodes()"
      [selectionMode]="$any(config().selectionMode) ?? null"
      [selection]="$any(selection())"
      (selectionChange)="selection.set($any($event))"
      [filter]="!!config().filter"
      [filterMode]="config().filterMode || 'lenient'"
      [filterPlaceholder]="config().filterPlaceholder || 'Search…'"
      [scrollHeight]="config().scrollHeight ?? ''"
      [virtualScroll]="!!config().virtualScroll"
      [virtualScrollItemSize]="config().virtualScrollItemSize || 32"
      [emptyMessage]="config().emptyMessage || 'No items'"
      [indentation]="config().indentation ?? 20"
      styleClass="dph-tree"
      (onNodeSelect)="nodeSelect.emit($any($event.node))"
      (onNodeUnselect)="nodeUnselect.emit($any($event.node))"
      (onNodeExpand)="onNodeExpand($event.node)"
      (onNodeCollapse)="nodeCollapse.emit($any($event.node))"
    />
  `,
  styles: [
    `
      :host { display: block; }
      :host ::ng-deep .dph-tree .p-tree-filter-container { padding: 0.5rem; }
      :host ::ng-deep .dph-tree .p-treenode-content { border-radius: var(--ep-radius-sm); }
      :host ::ng-deep .dph-tree .p-treenode-content:focus-visible {
        outline: 2px solid var(--ep-color-jessamine-500);
        outline-offset: 2px;
      }
    `,
  ],
})
export class TreeComponent<T = unknown> {
  readonly config = input.required<TreeConfig<T>>();
  readonly nodes = input<readonly TreeNode<T>[]>([]);
  readonly selection = model<TreeNode<T> | TreeNode<T>[] | null>(null);

  readonly nodeSelect = output<TreeNode<T>>();
  readonly nodeUnselect = output<TreeNode<T>>();
  readonly nodeExpand = output<TreeNode<T>>();
  readonly nodeCollapse = output<TreeNode<T>>();
  readonly lazyLoad = output<TreeNode<T>>();

  /** PrimeNG TreeNode shape is largely compatible with ours; cast for the directive. */
  protected readonly primeNodes = computed<PrimeTreeNode[]>(
    () => this.nodes() as unknown as PrimeTreeNode[],
  );

  protected onNodeExpand(node: PrimeTreeNode): void {
    const ours = node as unknown as TreeNode<T>;
    this.nodeExpand.emit(ours);
    if (this.config().lazy && ours.leaf === false && (!ours.children || ours.children.length === 0)) {
      this.lazyLoad.emit(ours);
    }
  }
}
