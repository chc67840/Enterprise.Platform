/**
 * ─── UNSAVED-CHANGES GUARD (functional CanDeactivate) ───────────────────────────
 *
 * WHY
 *   Forms with unsaved edits should warn before navigation — losing a
 *   half-typed entity edit to an accidental back-button click is a
 *   trust-destroying UX. This guard asks the departing component "are you
 *   dirty?" and renders a native confirm when the answer is yes.
 *
 * HOW COMPONENTS OPT IN
 *   The component implements the `HasUnsavedChanges` interface:
 *
 *     ```ts
 *     export class UserFormComponent implements HasUnsavedChanges {
 *       readonly form = this.builder.buildFormGroup(...);
 *
 *       hasUnsavedChanges(): boolean {
 *         return this.form.dirty;
 *       }
 *     }
 *     ```
 *
 *   And the route registers the guard:
 *
 *     ```ts
 *     { path: 'new', component: UserFormComponent, canDeactivate: [unsavedChangesGuard] }
 *     ```
 *
 * WHY A NATIVE `confirm()` (not a PrimeNG dialog)
 *   Two reasons:
 *     1. Route guards must return a boolean / Promise<boolean> / Observable<boolean>
 *        synchronously-enough that Angular can cancel the navigation. A PrimeNG
 *        dialog requires an active view + user interaction loop which doesn't
 *        fit cleanly into guard return semantics.
 *     2. Native `confirm()` is a11y-complete, keyboard-friendly, and won't
 *        fail when the outgoing view is mid-destroy.
 *
 *   A Phase-5 enhancement (`ConfirmationService.confirm(...)`) could swap in
 *   a themed dialog if product wants it, but the default is good enough.
 *
 * GOTCHA
 *   The confirm message is currently fixed text. If you need per-form copy,
 *   add a `getUnsavedChangesMessage?(): string` override to `HasUnsavedChanges`.
 */
import { type CanDeactivateFn } from '@angular/router';

/** Contract a component must implement to participate in the guard. */
export interface HasUnsavedChanges {
  /** Returns `true` when there are unsaved edits that would be lost on navigation. */
  hasUnsavedChanges(): boolean;

  /** Optional — provide custom confirm text. Defaults to a generic English message. */
  getUnsavedChangesMessage?(): string;
}

const DEFAULT_MESSAGE =
  'You have unsaved changes. If you leave now, your changes will be lost. Continue?';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }

  const msg = component.getUnsavedChangesMessage?.() ?? DEFAULT_MESSAGE;
  // Native confirm() is intentional — see file comment. The `no-alert` rule
  // isn't enabled globally, but should callers turn it on they'll need this
  // suppression.
  return window.confirm(msg);
};
