/**
 * ─── VITEST CONFIG ──────────────────────────────────────────────────────────────
 *
 * Consumed by Angular's `@angular/build:unit-test` builder (runner: 'vitest')
 * from Angular 21. Lives in the workspace root alongside `angular.json` —
 * `@angular/build` discovers it automatically.
 *
 * WHY THIS SHAPE
 *   - `jsdom` environment — specs exercise `window`, `fetch`-like code, and
 *     DOM-dependent Angular TestBed harnesses.
 *   - `globals: true` — matches `tsconfig.spec.json`'s `types: ['vitest/globals']`.
 *   - `include` limited to `src/**` — keeps Vitest off `dist/` + `node_modules`
 *     + the Playwright `e2e/` tree.
 *   - Path alias resolution mirrors `tsconfig.json` so the same imports
 *     (`@config/...`, `@core/...`, `@env/...`) work under test.
 *
 * COVERAGE THRESHOLDS (Phase 4.5)
 *   Set per-tier thresholds so a regression in core invariants (HTTP
 *   interceptors, guards, stores) can't merge. `features/*` has a more
 *   lenient floor since feature slices carry a lot of template code that
 *   rarely benefits from unit coverage (E2E covers it better).
 *
 *   - `lines` + `functions` are the primary gates.
 *   - `statements` shadows lines closely; kept in sync.
 *   - `branches` is intentionally looser — not every error-handling branch
 *     in a pure UI layer is worth a dedicated spec. Tighten as the suite
 *     grows.
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('src/app/core'),
      '@shared': r('src/app/shared'),
      '@features': r('src/app/features'),
      '@layouts': r('src/app/layouts'),
      '@config': r('src/app/config'),
      '@models': r('src/app/core/models'),
      '@env': r('src/environments'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**', '.angular/**', 'e2e/**'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/app/**/*.ts'],
      exclude: [
        'src/app/**/*.spec.ts',
        'src/app/**/index.ts',
        'src/app/**/*.model.ts',
        'src/app/**/*.types.ts',
        'src/app/**/*.config.ts',
        'src/app/config/app.config.ts',
        'src/app/core/observability/web-vitals-budgets.ts',
        'src/main.ts',
      ],
      // Global baseline — matches or exceeds the per-tier floors below.
      thresholds: {
        lines: 40,
        functions: 40,
        statements: 40,
        branches: 30,

        // Per-tier thresholds. Glob keys are matched against the coverage
        // report's file paths. Leave feature coverage loose until real
        // features land — E2E owns feature-level regression there.
        'src/app/core/interceptors/**': {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 60,
        },
        'src/app/core/guards/**': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 80,
        },
        'src/app/core/store/**': {
          lines: 75,
          functions: 75,
          statements: 75,
          branches: 55,
        },
      },
    },
  },
});
