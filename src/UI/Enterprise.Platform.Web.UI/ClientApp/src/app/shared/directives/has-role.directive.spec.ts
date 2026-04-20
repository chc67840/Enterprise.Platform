/**
 * ─── HasRoleDirective — UNIT TESTS ──────────────────────────────────────────────
 *
 * PHASE 4 STATUS — DEFERRED TO PHASE 5 (see `has-permission.directive.spec.ts`
 * for rationale). The directive semantics are identical to HasPermission apart
 * from reading `hasAnyRole` instead of `hasAnyPermission`. Coverage of the
 * underlying role-check contract lives in `auth.store.spec.ts` +
 * `role.guard.spec.ts`.
 */
import { describe, it } from 'vitest';

describe.skip('HasRoleDirective (deferred to Phase 5)', () => {
  it('covered indirectly by auth.store.spec.ts + role.guard.spec.ts', () => {
    /* see file header */
  });
});
