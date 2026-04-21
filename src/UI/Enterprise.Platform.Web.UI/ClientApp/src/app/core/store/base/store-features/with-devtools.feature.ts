/**
 * ─── withDevtools(name) ────────────────────────────────────────────────────────
 *
 * Thin wrapper around `@angular-architects/ngrx-toolkit`'s devtools feature.
 * Enabled only when `environment.production === false` so production bundles
 * don't carry the devtools surface.
 *
 * USAGE
 *   ```ts
 *   const UsersStore = signalStore(
 *     { providedIn: 'root' },
 *     withState(initial),
 *     withDevtools('Users'),
 *     // …
 *   );
 *   ```
 *
 * PRODUCTION
 *   In production builds `environment.production === true` → this feature
 *   returns an empty no-op feature. The devtools dependency still loads
 *   (tree-shaking would require a conditional dynamic import) but no state
 *   is emitted; the perf impact is negligible.
 *
 * WHY A PROJECT-OWNED WRAPPER
 *   Reviewers see one factory call, not an upstream library call. If we ever
 *   swap toolkits (e.g. adopt Redux DevTools directly), we change one file.
 */
import { signalStoreFeature, withMethods } from '@ngrx/signals';
import {
  withDevtools as toolkitWithDevtools,
} from '@angular-architects/ngrx-toolkit';

import { environment } from '@env/environment';

export function withDevtools(name: string) {
  if (environment.production) {
    // Return a structurally-valid no-op feature — empty `withMethods` adds
    // nothing to the store while satisfying the feature-graph type.
    return signalStoreFeature(withMethods(() => ({})));
  }
  return toolkitWithDevtools(name);
}
