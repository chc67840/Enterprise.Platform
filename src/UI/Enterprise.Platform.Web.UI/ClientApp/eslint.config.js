/**
 * ─── ESLint FLAT CONFIG ─────────────────────────────────────────────────────────
 *
 * WHY
 *   Enforces architecture + security + style invariants described in
 *   `Docs/Architecture/UI-Architecture.md`:
 *
 *     - Tier boundaries (`core` ≺ `shared` ≺ `layouts` ≺ `features`).
 *     - No high-entropy string literals (catches accidentally committed secrets / API keys).
 *     - Common security pitfalls (`eval`, unsafe regex).
 *     - Angular component rules (standalone, OnPush, class suffixes, inject() preferred).
 *
 * FLAT CONFIG
 *   ESLint 9+ uses `eslint.config.js` (flat config). It replaces the legacy
 *   `.eslintrc.json` + `overrides` + `extends` hierarchy with plain JS
 *   composition. Each exported config object applies to its `files` glob.
 *
 * DESIGN NOTE
 *   Rules are listed explicitly rather than spreading a preset's config array.
 *   Different plugin versions expose presets in different shapes
 *   (`flat/recommended` vs `configs.recommended` vs `flatConfigs.*`), which
 *   can break on upgrade. Enumerating the rules we care about is stable and
 *   keeps this file's intent obvious.
 */
// @ts-check
import js from '@eslint/js';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import noSecrets from 'eslint-plugin-no-secrets';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'node_modules/**',
      'out-tsc/**',
      'coverage/**',
      '**/__screenshots__/**',
      'test-results/**',
      'playwright-report/**',
      'eslint.config.js',
      'commitlint.config.js',
      // Playwright E2E specs run under their own tsconfig; the main app
      // config's `projectService` doesn't resolve them. Cover via Playwright's
      // own lint pass (not wired yet) when the suite expands.
      'e2e/**',
    ],
  },

  // ── TypeScript + Angular rules ────────────────────────────────────────
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // `projectService: true` auto-discovers the right tsconfig per file
        // (app vs spec) via TypeScript's own project-reference resolution.
        // Replaces the older `project: [...]` list which doesn't traverse
        // project references.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@angular-eslint': angular,
      import: importPlugin,
      'no-secrets': noSecrets,
      security,
    },
    rules: {
      // ── Architecture: tier boundaries ─────────────────────────────────
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/app/core',
              from: './src/app/features',
              message: 'core → features is forbidden (feature code is not a core concern).',
            },
            {
              target: './src/app/core',
              from: './src/app/layouts',
              message: 'core → layouts is forbidden.',
            },
            {
              target: './src/app/shared',
              from: './src/app/features',
              message: 'shared → features is forbidden.',
            },
            {
              target: './src/app/shared',
              from: './src/app/layouts',
              message: 'shared → layouts is forbidden.',
            },
          ],
        },
      ],

      // ── Security ────────────────────────────────────────────────────
      'no-secrets/no-secrets': ['error', { tolerance: 4.5, ignoreContent: ['pi-[a-z-]+'] }],
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      // Disabled — noisy on legitimate bracket-notation writes (store dict updates).
      'security/detect-object-injection': 'off',

      // ── Angular conventions ─────────────────────────────────────────
      '@angular-eslint/component-class-suffix': ['error', { suffixes: ['Component'] }],
      '@angular-eslint/directive-class-suffix': ['error', { suffixes: ['Directive'] }],
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'warn',
      '@angular-eslint/use-lifecycle-interface': 'error',

      // ── TypeScript style ─────────────────────────────────────────────
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Console policy ───────────────────────────────────────────────
      // Structured logging goes through `LoggerService`. The service has a
      // single `// eslint-disable-next-line no-console` in its `write()`
      // method — the only approved console-call site.
      'no-console': 'error',
    },
  },

  // ── Angular template rules (HTML) ─────────────────────────────────────
  {
    files: ['**/*.html'],
    languageOptions: { parser: angularTemplateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      '@angular-eslint/template/banana-in-box': 'error',
      '@angular-eslint/template/no-duplicate-attributes': 'error',
      '@angular-eslint/template/no-negated-async': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
    },
  },
);
