/**
 * ─── *appHasRole STRUCTURAL DIRECTIVE ───────────────────────────────────────────
 *
 * Template-level equivalent of `roleGuard`. Mounts the host element iff the
 * user is in any of the supplied roles (OR semantics).
 *
 * USAGE
 *   ```html
 *   <button *appHasRole="'admin'" (click)="rotateKeys()">Rotate keys</button>
 *
 *   <nav-link *appHasRole="['admin', 'manager']" to="/reports">
 *     Reports
 *   </nav-link>
 *   ```
 *
 * ROLE vs PERMISSION
 *   Prefer `*appHasPermission` for action gating (what the user may do).
 *   Reserve `*appHasRole` for role-branded UI (sections labelled "Admin
 *   Tools", "Manager View") where the role is itself the UX concept.
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
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  readonly appHasRole = input.required<string | readonly string[]>();

  private readonly template = inject(TemplateRef<unknown>);
  private readonly view = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  private isRendered = false;

  constructor() {
    effect(() => {
      const required = this.appHasRole();
      const roles = Array.isArray(required) ? required : [required];
      const allowed = this.auth.hasAnyRole(...roles);

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
