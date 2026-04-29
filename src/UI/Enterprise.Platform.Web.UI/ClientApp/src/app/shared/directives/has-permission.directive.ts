/**
 * ─── *appHasPermission STRUCTURAL DIRECTIVE ─────────────────────────────────────
 *
 * WHY
 *   Route guards hide entire pages. But inside a page you often want to hide
 *   individual buttons / sections / cells based on the user's permissions —
 *   e.g. "Delete" button only for users with `users.delete`.
 *
 *   This directive is the template-level equivalent of `permissionGuard`: it
 *   mounts (renders) its host element iff `AuthStore.hasAnyPermission(...)`
 *   returns true for the supplied permission(s).
 *
 * USAGE
 *   ```html
 *   <!-- Single permission -->
 *   <button *appHasPermission="'users.delete'" (click)="delete(user)">
 *     Delete
 *   </button>
 *
 *   <!-- Array → OR semantics (any one match renders) -->
 *   <div *appHasPermission="['reports.read', 'reports.export']">
 *     Reports panel
 *   </div>
 *   ```
 *
 * WHY OR RATHER THAN AND
 *   In templates, "show this when the user has any of these permissions" is
 *   overwhelmingly the more common case (e.g. "show the reports panel when
 *   the user has ANY report-related permission"). A separate
 *   `*appHasAllPermissions` directive can be added when the need arises;
 *   until then, AND logic is easy to express via two nested structural
 *   directives if really needed.
 *
 * REACTIVITY
 *   `AuthStore.permissions()` is a signal. The directive reads it inside an
 *   `effect()` so the view mounts/unmounts automatically when the set changes
 *   (e.g. after re-hydration when a role is granted mid-session).
 *
 *   In zoneless mode this Just Works — no manual CD needed.
 */
import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { AuthStore } from '@core/auth/auth.store';

@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  /** Accepts a single string or an array of strings — OR semantics. */
  readonly appHasPermission = input.required<string | readonly string[]>();

  private readonly template = inject(TemplateRef<unknown>);
  private readonly view = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  /** Tracks whether the view is currently embedded so we don't re-render unnecessarily. */
  private isRendered = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const perms = Array.isArray(required) ? required : [required];
      const allowed = this.auth.hasAnyPermission(...perms);

      if (allowed && !this.isRendered) {
        this.view.createEmbeddedView(this.template);
        this.isRendered = true;
      } else if (!allowed && this.isRendered) {
        this.view.clear();
        this.isRendered = false;
      }
    });
  }
}
