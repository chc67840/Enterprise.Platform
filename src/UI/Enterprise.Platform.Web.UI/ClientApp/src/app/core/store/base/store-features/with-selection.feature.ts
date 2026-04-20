/**
 * ─── withSelection() ────────────────────────────────────────────────────────────
 *
 * Row-selection state for list views that support multi-select (bulk delete,
 * bulk export, compare, etc.).
 *
 * WHAT IT ADDS
 *   State:   selectedIds (ordered set of selected row ids)
 *   Computed: hasSelection, selectionCount
 *   Methods: select, deselect, toggle, selectAll, clearSelection
 *
 * WHY `readonly string[]` AND NOT `Set<string>`
 *   NGRX Signals state should be structurally comparable — `patchState`
 *   uses reference equality to decide whether subscribers re-run. `Set`
 *   objects compare by reference regardless of contents, so every update
 *   would cascade. A sorted array is diff-friendly and templates can
 *   iterate it directly.
 *
 * GOTCHA
 *   `selectedIds` is not auto-pruned when rows leave the list after a
 *   pagination change or filter. The store factory's `deleteEntity` prunes
 *   on actual deletion, but list changes leave orphan ids in selection.
 *   Phase 6 enhancement: `withSelection({ auto-prune: true })` — listens
 *   to ids changes and drops selections whose ids no longer exist.
 */
import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export interface SelectionState {
  readonly selectedIds: readonly string[];
}

export function withSelection() {
  return signalStoreFeature(
    withState<SelectionState>({ selectedIds: [] }),
    withComputed((store) => ({
      /** True when at least one row is selected. */
      hasSelection: computed(() => store.selectedIds().length > 0),
      /** Count of selected rows. */
      selectionCount: computed(() => store.selectedIds().length),
    })),
    withMethods((store) => ({
      /** Adds an id to the selection (no-op if already selected). */
      select: (id: string) => {
        if (store.selectedIds().includes(id)) return;
        patchState(store, { selectedIds: [...store.selectedIds(), id] });
      },

      /** Removes an id from the selection. */
      deselect: (id: string) =>
        patchState(store, {
          selectedIds: store.selectedIds().filter((x) => x !== id),
        }),

      /** Toggles an id — selects if absent, deselects if present. */
      toggle: (id: string) =>
        patchState(store, {
          selectedIds: store.selectedIds().includes(id)
            ? store.selectedIds().filter((x) => x !== id)
            : [...store.selectedIds(), id],
        }),

      /** Replaces selection with every id supplied. */
      selectAll: (ids: readonly string[]) => patchState(store, { selectedIds: [...ids] }),

      /** Empties the selection. */
      clearSelection: () => patchState(store, { selectedIds: [] }),
    })),
  );
}
