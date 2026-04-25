/**
 * ─── DEPENDENCY-CRUISER ─────────────────────────────────────────────────────────
 *
 * Enforces architectural invariants from `Docs/Architecture/UI-Architecture.md`
 * §1.3 (Tier model). Rules fail the build when an import crosses a forbidden
 * tier boundary.
 *
 * HOW TO RUN
 *   npm run arch:check
 *
 * ENFORCED RULES (errors — fail CI)
 *   1. `core` cannot import from `features` / `layouts` / shared components.
 *   2. `shared` cannot import from `features` / `layouts` / `core` services.
 *   3. `features/<X>` cannot import from `features/<Y>` (no peer-feature coupling).
 *   4. `@env/environment` (the build-time config POCO) may only be read from
 *      `config/` + a handful of core services that need offline fallbacks.
 *   5. No cycles (standard cruiser recommendation).
 *
 * STYLE RULES (warnings)
 *   - Prefer type-only imports for type symbols (lint-enforced elsewhere; we
 *     keep this light here).
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-features',
      severity: 'error',
      comment:
        'core/ holds framework-free singletons. Importing from features/* or layouts/* inverts the tier model (UI-Architecture §1.3).',
      from: { path: '^src/app/core' },
      to: { path: '^src/app/(features|layouts)' },
    },
    {
      name: 'core-must-not-import-shared-components',
      severity: 'error',
      comment:
        'core/ may consume type-only declarations from shared but not concrete UI primitives. Reverse the dependency — the component belongs under shared or layouts.',
      from: { path: '^src/app/core' },
      to: { path: '^src/app/shared/components' },
    },
    {
      name: 'shared-must-not-import-features-or-layouts',
      severity: 'error',
      comment:
        'shared/ ships reusable UI primitives. Importing a feature or layout means the primitive has an implicit dependency on domain code — push the coupling back up.',
      from: { path: '^src/app/shared' },
      to: { path: '^src/app/(features|layouts)' },
    },
    {
      name: 'shared-must-not-import-feature-tier-core',
      severity: 'error',
      comment:
        'shared/ may consume cross-cutting infrastructure (core/services/* logger/notification/correlation-context, core/observability/*) but must NOT reach into feature-coupled core modules (http, store, guards, interceptors). Those are consumed by features, not shared primitives.',
      from: { path: '^src/app/shared' },
      to: {
        path: '^src/app/core/(http|store|guards|interceptors)',
      },
    },
    {
      name: 'features-must-not-import-peer-features',
      severity: 'error',
      comment:
        'features/<X> cannot import from features/<Y>. Cross-feature coupling should go through a shared domain primitive under shared/ or core/.',
      from: { path: '^src/app/features/([^/]+)/' },
      to: {
        path: '^src/app/features/([^/]+)/',
        pathNot: '^src/app/features/$1/',
      },
    },
    {
      name: 'env-only-in-config-and-whitelist',
      severity: 'error',
      comment:
        '@env/environment exposes BUILD-TIME config. Runtime-varying reads must go through RUNTIME_CONFIG. Only config/* + the small offline-fallback consumers may import it.',
      from: {
        path: '^src/app',
        pathNot: [
          '^src/app/config/',
          '^src/app/core/observability/telemetry\\.service\\.ts$',
          '^src/app/core/observability/global-error-handler\\.service\\.ts$',
          '^src/app/core/services/logger\\.service\\.ts$',
          '^src/app/core/interceptors/retry\\.interceptor\\.ts$',
          // Phase 6.2.4 — `withDevtools` branches on `environment.production`
          // to no-op in prod builds. Reading the build-time flag directly is
          // the whole point; it must never be a runtime-config override.
          '^src/app/core/store/base/store-features/with-devtools\\.feature\\.ts$',
        ],
      },
      to: { path: '^src/environments' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies are forbidden — they break tree-shaking, confuse DI ordering, and signal unclear ownership.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Orphaned modules (no incoming or outgoing deps) are usually a refactoring miss. Warn only so legitimate utilities (init-only modules) stay legal.',
      from: {
        orphan: true,
        pathNot: [
          '\\.spec\\.ts$',
          '\\.d\\.ts$',
          '^src/main\\.ts$',
          '^src/test-setup\\.ts$',
          '^src/app/app\\.routes\\.ts$',
          '^src/app/app\\.ts$',
          '^src/environments/',
          // Model files are consumed via `@core/models` barrel; cruiser's
          // import resolver doesn't always traverse index re-exports so
          // they appear orphaned. Exempt them.
          '^src/app/core/models/',
          // Same reason for `.types.ts` files — they re-export through a
          // sibling `index.ts` (e.g. shared/components/navigation/nav-menu.types.ts).
          '\\.types\\.ts$',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: '^src/',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
