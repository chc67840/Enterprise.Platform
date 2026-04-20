/**
 * ─── VITEST CONFIG ──────────────────────────────────────────────────────────────
 *
 * Consumed by Angular's `@angular/build:unit-test` builder (runner: 'vitest')
 * from Angular 21. Lives in the workspace root alongside `angular.json` —
 * `@angular/build` discovers it automatically.
 *
 * WHY THIS SHAPE
 *   - `jsdom` environment — the loader spec exercises `window`, `fetch`-like
 *     code, and runtime config mutation; Node's plain environment isn't enough.
 *   - `globals: true` — matches `tsconfig.spec.json`'s `types: ['vitest/globals']`.
 *   - `include` limited to `src/**` — keeps Vitest off `dist/` + `node_modules`.
 *   - Path alias resolution mirrors `tsconfig.json` so the same imports
 *     (`@config/...`, `@core/...`, `@env/...`) work under test.
 *
 * KEEP THIN
 *   Complex Angular-testing harnesses (TestBed, DI overrides) land with the
 *   Phase-4 testing foundation. Phase 2 only needs this minimal setup so the
 *   runtime-config loader can be unit-tested in isolation.
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
    exclude: ['dist/**', 'node_modules/**', '.angular/**'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/app/**/*.ts'],
      exclude: [
        'src/app/**/*.spec.ts',
        'src/app/**/index.ts',
        'src/main.ts',
      ],
    },
  },
});
