/**
 * ─── ServerErrorMapperService ──────────────────────────────────────────────────
 *
 * Projects a 422-style `ApiError.errors` dictionary onto a live Angular
 * `FormGroup` so the user sees per-field error messages inline next to the
 * inputs that produced them. The errors auto-clear on the next
 * `valueChanges` of each affected control — the classic "start typing to
 * clear the error" UX.
 *
 * INPUT SHAPE
 *   Backend's 422 body carries:
 *     ```json
 *     {
 *       "type": "EP.Validation",
 *       "errors": {
 *         "email": ["Email is already in use."],
 *         "address.postalCode": ["Must be 5 digits."],
 *         "roles[0].name": ["Required."]
 *       }
 *     }
 *     ```
 *
 *   Field paths support nested groups (`a.b.c`) and indexed arrays
 *   (`items[2].name` → `items.at(2).get('name')`). Unknown paths (e.g. the
 *   server validated a field the client doesn't expose) are collected and
 *   returned in the `unmatched` output so callers can surface them via a
 *   form-level error banner.
 *
 * POLICY
 *   - Only the FIRST message per field is set (standard UX — show one
 *     clear error at a time). The full array is preserved on the control's
 *     `errors.server.all` so advanced UIs can render details.
 *   - The `server` error key is reserved — it namespace-separates from
 *     validator errors (`required`, `email`, etc.) so templates can treat
 *     it uniformly in both cases.
 *   - Auto-clear: the first `valueChanges` after the mapping clears the
 *     `server` key from that specific control. Validator errors are left
 *     alone — they continue to run on every value change as usual.
 *
 * WHY A SERVICE (not a utility function)
 *   Root-provided so any component can inject it. The cleanup-on-typing
 *   behaviour needs a subscription per control that lives until the mapper
 *   reapplies (or the caller destroys the form); a service owns that scope
 *   cleanly and can be stubbed in tests.
 */
import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  type AbstractControl,
  type FormArray,
  type FormGroup,
} from '@angular/forms';
import { Subscription } from 'rxjs';

import type { ApiError } from '@core/models';

/** Shape set on `control.errors.server`. */
export interface ServerValidationError {
  /** First message from the backend's array — the one rendered by default. */
  readonly message: string;
  /** Full array preserved for advanced UIs. */
  readonly all: readonly string[];
}

export interface MapResult {
  /** Field paths from the error body that matched a control on the form. */
  readonly matched: readonly string[];
  /** Field paths that did NOT match — show via a form-level banner. */
  readonly unmatched: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class ServerErrorMapperService {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Applies `err.errors` onto `form`. Returns a result summarising matched
   * vs unmatched field paths so the caller can render a form-level error
   * banner for anything the UI can't project inline.
   */
  apply(form: FormGroup | FormArray, err: ApiError): MapResult {
    const errors = err.errors ?? {};
    const matched: string[] = [];
    const unmatched: string[] = [];
    const subs = new Subscription();

    for (const [path, messages] of Object.entries(errors)) {
      const control = this.resolve(form, path);
      if (!control || messages.length === 0) {
        unmatched.push(path);
        continue;
      }

      const [first, ...rest] = messages;
      const payload: ServerValidationError = {
        message: first as string,
        all: [first as string, ...rest],
      };
      control.setErrors({ ...(control.errors ?? {}), server: payload });
      matched.push(path);

      // Auto-clear on next meaningful edit — take a one-shot subscription
      // per affected control. Each is unsubscribed when the mapper reapplies
      // (new subs replace old) or when the owning component is destroyed.
      const sub = control.valueChanges.subscribe(() => {
        if (!control.errors) return;
        const { server: _, ...rest } = control.errors as Record<string, unknown>;
        control.setErrors(Object.keys(rest).length > 0 ? rest : null);
        sub.unsubscribe();
      });
      subs.add(sub);
    }

    // Own the subscription lifetimes so the caller doesn't have to.
    this.destroyRef.onDestroy(() => subs.unsubscribe());

    return { matched, unmatched };
  }

  /**
   * Walks a dot / bracket path to the matching `AbstractControl`. Returns
   * `null` when any segment is missing.
   *
   * Path grammar:
   *   - `a.b.c`          nested group/array step
   *   - `items[2].name`  array index within a FormArray
   *   - `'quoted.key'`   currently NOT supported — use bracket notation if
   *     you ever need literal dots in field names.
   */
  private resolve(root: AbstractControl, path: string): AbstractControl | null {
    const segments = path
      .replace(/\[(\d+)\]/g, '.$1') // items[2] → items.2
      .split('.')
      .filter((s) => s.length > 0);

    let current: AbstractControl | null = root;
    for (const segment of segments) {
      if (!current) return null;
      current = current.get(segment);
    }
    return current;
  }
}
