# UI Config Files — Deep Reference

**Scope:** every top-level configuration file inside
`src/UI/Enterprise.Platform.Web.UI/ClientApp/`. For each file: what it does,
why it exists, what breaks without it, and a real catch-example.

**Audience:** new contributors onboarding to the SPA, anyone debating
"do we still need this file?", reviewers auditing the build chain.

**Companion docs:**
- [`UI-Architecture.md`](./UI-Architecture.md) — overall SPA architecture
- [`UI-Styling-Strategy.md`](./UI-Styling-Strategy.md) — PrimeNG + Tailwind decision
- [`10-Enterprise-Folder-Structure.md`](./10-Enterprise-Folder-Structure.md) — solution-wide folder model

---

## TL;DR — quick reference table

| File | Verdict | One-line role |
|---|---|---|
| `.dependency-cruiser.cjs` | **Keep** | Architecture-graph rules: no peer-feature coupling, no cycles, env whitelist |
| `.editorconfig` | **Keep** | Cross-IDE formatting (indent, charset, EOL) |
| `.gitignore` | **Keep + add `storybook-static/`** | Excludes build output / IDE cruft |
| `.lintstagedrc.json` | **Keep** | Pre-commit pipeline orchestration |
| `.postcssrc.json` | **Required** | Tailwind v4 PostCSS plugin registration |
| `.prettierignore` | **Keep** | Keeps Prettier off lock files / build output |
| `.prettierrc` | **Keep** | Formatter settings (Angular HTML parser, 100-char width) |
| `.secretlintignore` | **Keep** | Secretlint scope |
| `.secretlintrc.json` | **Keep** | Format-specific secret detectors |
| `angular.json` | **Required** | Angular CLI workspace, builders, budgets |
| `commitlint.config.js` | **Keep** | Conventional Commits + scope enum |
| `eslint.config.js` | **Keep** | Tier boundary + security + Angular conventions |
| `package.json` | **Required** | npm manifest, scripts, engines pin |
| `package-lock.json` | **Required** | Deterministic dep resolution |
| `playwright.config.ts` | **Keep** | E2E scaffold (Phase 4 specs) |
| `README.md` | **Keep** | Onboarding |
| `tsconfig.json` | **Required** | Root TS config — strictness + path aliases |
| `tsconfig.app.json` | **Required** | App build scope (excludes specs) |
| `tsconfig.spec.json` | **Required** | Spec build scope (`vitest/globals` types) |
| `vitest.config.ts` | **Keep** | Unit-test runner, jsdom, per-tier coverage |
| `storybook-static/` (folder) | **Should be gitignored** | `npm run build-storybook` output |

**Net result:** every config file is load-bearing — none should be removed.
The only fix is adding `storybook-static/` to `.gitignore`.

---

## 1 · Build tooling — cannot ship without these

### 1.1 `angular.json` — Angular CLI workspace

**Status:** Required.

Angular CLI workspace descriptor. Tells `ng build / ng serve / ng test /
ng run …storybook` where the entry points, tsconfig, styles, assets, and
builders live.

**Key decisions encoded here:**

- `@angular/build:application` builder (esbuild — fast, tree-shakes) for
  the app — replaces the legacy `@angular-devkit/build-angular:browser`
  Webpack chain.
- Three configurations — `production` / `staging` / `development` — each
  with its own `environment.ts` file-replacement.
- **Bundle budgets:**
  - `initial: 1 MB warning / 2 MB error`
  - `anyComponentStyle: 4 kB warning / 8 kB error`
  Without budgets, a stray chart library or a 200-line inline template
  quietly inflates the initial chunk by 400 kB.
- `@angular/build:unit-test` builder wired to **Vitest** (not Karma).
  This is the Angular-21 way to run specs without a separate Karma config.
- `@storybook/angular:start-storybook` target so `npm run storybook` just
  works.
- `cli.analytics: false` — no telemetry to Google.

**What breaks if removed:** `ng build` fails instantly with
`No workspace file found`.

---

### 1.2 `tsconfig.json` — root TypeScript config

**Status:** Required.

Two important jobs:

1. **Strictness — every flag enabled:**
   ```json
   "strict": true,
   "noImplicitOverride": true,
   "noImplicitReturns": true,
   "noFallthroughCasesInSwitch": true,
   "noPropertyAccessFromIndexSignature": true,
   "noUncheckedIndexedAccess": true,
   "forceConsistentCasingInFileNames": true
   ```
   Together they catch the bulk of "works in dev, blows up in prod" bugs.

2. **Path aliases mirror the tier model:**
   ```json
   "paths": {
     "@core/*":     ["src/app/core/*"],
     "@shared/*":   ["src/app/shared/*"],
     "@features/*": ["src/app/features/*"],
     "@layouts/*":  ["src/app/layouts/*"],
     "@config/*":   ["src/app/config/*"],
     "@models/*":   ["src/app/core/models/*"],
     "@env/*":      ["src/environments/*"]
   }
   ```
   Combined with ESLint's `import/no-restricted-paths`, deep-path
   cross-tier imports become impossible.

3. **`angularCompilerOptions.strictTemplates: true`** — HTML templates are
   type-checked against the component class. Catches mistyped property
   bindings and missing input names at build time.

**Catch example:** In the user-menu work, `parts[parts.length - 1][0]`
failed `noUncheckedIndexedAccess` because array index access returns
`T | undefined`. Without this flag, it would have compiled and NPE'd at
runtime on single-word display names.

---

### 1.3 `tsconfig.app.json` — app build scope

**Status:** Required.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./out-tsc/app", "types": [] },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

Just overrides `include` / `exclude` to **exclude `*.spec.ts`** so test-only
imports never land in the production bundle. Inherits everything else from
the root config. Empty `types: []` prevents implicit `@types/*` packages
from polluting the app's global type space.

---

### 1.4 `tsconfig.spec.json` — spec build scope

**Status:** Required.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "./out-tsc/spec", "types": ["vitest/globals", "node"] },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

Adds `vitest/globals` + `node` to the `types` array so `describe / it /
expect` are typed globally in specs. Without it, every spec file would
need `import { describe, it, expect } from 'vitest';` at the top.

---

### 1.5 `.postcssrc.json` — Tailwind v4 PostCSS plugin

**Status:** Required.

```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

Angular's bundler pipes every `.css` file through PostCSS before bundling;
this file tells PostCSS to run the Tailwind v4 plugin which compiles
`@import 'tailwindcss'`, `@theme`, `@utility`, etc.

**What breaks if removed:** Tailwind utility classes (`flex`, `bg-primary-600`,
`rounded-ep-md`) emit as raw text in the CSS output. Every page renders
un-styled. Catastrophic.

---

## 2 · Code quality — drift prevention

### 2.1 `eslint.config.js` — architecture insurance

**Status:** Keep — this is your most important quality gate.

ESLint 9 flat config. Three layers of rules:

#### Layer A — tier-boundary enforcement
```js
'import/no-restricted-paths': ['error', {
  zones: [
    { target: './src/app/core',   from: './src/app/features', message: '…' },
    { target: './src/app/core',   from: './src/app/layouts',  message: '…' },
    { target: './src/app/shared', from: './src/app/features', message: '…' },
    { target: './src/app/shared', from: './src/app/layouts',  message: '…' },
  ],
}]
```
Violations fail `npm run lint` and CI.

#### Layer B — security hardening
- **`no-secrets/no-secrets`** entropy scan (tolerance 4.5) — flags any
  string literal random-looking enough to be an API key.
  `ignoreContent: ['pi-[a-z-]+']` whitelists PrimeIcons class names
  (`pi-bell`, `pi-chevron-down`, etc.) which are otherwise high-entropy.
- **`security/detect-eval-with-expression: error`** — blocks dynamic
  code execution.
- **`security/detect-unsafe-regex: error`** — blocks ReDoS-vulnerable
  patterns.
- `security/detect-object-injection` is **disabled** because it's noisy
  on legitimate bracket-notation writes (e.g. store dictionary updates).

#### Layer C — Angular & TS conventions
| Rule | Enforces |
|---|---|
| `@angular-eslint/prefer-inject` | `inject()` over constructor DI |
| `@angular-eslint/component-class-suffix` | Class names end in `Component` |
| `@angular-eslint/directive-class-suffix` | Class names end in `Directive` |
| `@angular-eslint/use-lifecycle-interface` | `ngOnInit` requires `implements OnInit` |
| `@angular-eslint/no-empty-lifecycle-method` | Empty hooks must be deleted |
| `@angular-eslint/template/banana-in-box` | Catches `([ngModel])` typo |
| `@angular-eslint/template/no-duplicate-attributes` | Same attribute twice = bug |
| `@angular-eslint/template/no-negated-async` | `!(obs$ \| async)` is almost always wrong |
| `@typescript-eslint/consistent-type-imports` | `import type { Foo }` for types |
| `@typescript-eslint/no-unused-vars` | `_prefix` allowed; everything else errors |
| `@typescript-eslint/no-explicit-any` | `any` is forbidden |
| `no-console` | All logs must go through `LoggerService` |

**Catch example:** if someone in `core/http/retry.interceptor.ts` writes
`import { Dashboard } from '@features/dashboard'` to read a default page
size, ESLint errors: *"core → features is forbidden"*. This is the rule
that keeps Clean Architecture clean.

#### Why flat config (not `.eslintrc.json`)
ESLint 9+ uses `eslint.config.js`. It replaces the legacy `.eslintrc` +
`overrides` + `extends` hierarchy with plain JS composition. Each exported
config object applies to its `files` glob. Rules are listed explicitly
rather than spreading a preset's config array because different plugin
versions expose presets in different shapes (`flat/recommended` vs
`configs.recommended` vs `flatConfigs.*`) — enumerating the rules we care
about is stable across upgrades.

---

### 2.2 `.editorconfig` — cross-IDE formatting

**Status:** Keep.

```ini
[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.ts]
quote_type = single
ij_typescript_use_double_quotes = false
```

Read natively by VS Code, JetBrains IDEs, Vim, Sublime without any plugin.
Keeps 2-space vs 4-space wars dead. The `[*.ts]` block tells JetBrains
specifically (`ij_…` keys) not to auto-convert single quotes to double.

---

### 2.3 `.prettierrc` — formatter settings

**Status:** Keep.

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "overrides": [
    { "files": "*.html", "options": { "parser": "angular" } }
  ]
}
```

Prettier is the only thing deciding line-breaking and quote style. The
**Angular parser for HTML** is critical — the default HTML parser mangles
Angular template syntax (`@if`, `@for`, `[class.foo]`, `*ngFor`,
control-flow blocks).

---

### 2.4 `.prettierignore` — formatter scope

**Status:** Keep.

```
dist/
node_modules/
.angular/
out-tsc/
coverage/
__screenshots__/
package-lock.json
```

Re-formatting `package-lock.json` would make diffs unreadable and
regenerate spurious churn. Excluding build directories prevents wasted
formatter cycles.

---

## 3 · Testing

### 3.1 `vitest.config.ts` — unit-test runner

**Status:** Keep.

Three important pieces:

1. **Path aliases** duplicated from `tsconfig.json` — Vitest doesn't
   consume TS paths by default.
2. **`environment: 'jsdom'`** — specs can reach `document`, `window`,
   `fetch`. Required for Angular TestBed harnesses.
3. **Coverage thresholds per tier** — strictness scales with the cost of
   regression:

| Tier | Lines | Branches | Why |
|---|---|---|---|
| `core/guards/**` | **90%** | 80% | Auth gate; near-bulletproof |
| `core/interceptors/**` | 80% | 60% | Cross-cutting HTTP behaviour |
| `core/store/**` | 75% | 55% | State machine correctness |
| Everything else | 40% (global floor) | 30% | Feature/UI churn-rate |

**Catch example:** drop an `if (user?.bypass)` branch in a guard and
coverage falls below 80% — CI fails even if the suite is green. Stops
"I forgot to write the negative test" from merging.

---

### 3.2 `playwright.config.ts` — E2E harness

**Status:** Keep (scaffold for Phase-4 specs).

Currently Chromium-only. The valuable parts:

- `webServer.command: 'npm run start'` + `reuseExistingServer: !CI` —
  Playwright auto-boots the dev server locally; CI always uses a fresh one.
- `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`,
  `video: 'retain-on-failure'` — cheap, zero cost when green, invaluable
  when red.
- `forbidOnly: !!CI` — rejects `test.only(...)` in CI so an engineer can't
  accidentally ship a one-test suite.
- `timeout: 30_000`, `expect.timeout: 5_000` — explicit so a hung E2E
  doesn't wedge the build for 10 minutes.

Even with zero specs today, removing this means rewriting it when Phase-4
E2E specs land. Keep the scaffold.

---

## 4 · Git-hook pipeline

These four files interlock. Remove one and the chain breaks.

### 4.1 `.lintstagedrc.json` — pre-commit orchestration

**Status:** Keep.

```json
{
  "*":                         ["secretlint --maskSecrets"],
  "*.{ts,html}":               ["prettier --write", "eslint --fix --max-warnings=0"],
  "*.{css,json,md,yml,yaml}":  ["prettier --write"]
}
```

Runs on **staged files only** — fast. Enforces:
- secrets scanner on **everything** (regardless of extension)
- format + lint on code
- format on data/docs

Triggered by Husky's `pre-commit` hook (set up via `npm run prepare`,
which runs the `husky` package).

---

### 4.2 `commitlint.config.js` — commit-message gate

**Status:** Keep.

Enforces Conventional Commits (`feat(core): …`, `fix(auth): …`,
`chore(deps): …`) and pins the allowed `scope-enum` to our tier names +
subsystems:

```js
'scope-enum': [2, 'always', [
  // Tiers
  'core', 'shared', 'layouts', 'features', 'config',
  // Subsystems
  'auth', 'http', 'store', 'interceptors', 'guards', 'dynamic-form',
  // Ops / meta
  'build', 'deps', 'docs', 'tooling', 'ci',
]]
```

Lets tooling (release-please, changelog generators, PR stats) read our
git history as structured data.

**Catch example:** `git commit -m "update stuff"` is rejected with
*"subject may not be empty"* + *"type may not be empty"*. The engineer
writes `chore(auth): refresh session probe timeout` instead — and six
months later a release engineer can read "all `auth` changes since v2.3"
as a one-liner.

Triggered by Husky's `commit-msg` hook.

---

### 4.3 `.secretlintrc.json` + `.secretlintignore` — secret scanner

**Status:** Keep — non-negotiable.

```json
{ "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }] }
```

Secretlint runs **format-specific** detectors:
- AWS access keys (`AKIA…`)
- GitHub PATs (`ghp_…`)
- Slack webhooks (`https://hooks.slack.com/…`)
- Stripe live keys (`sk_live_…`)
- OpenAI keys (`sk-…`)
- Anthropic keys (`sk-ant-…`)
- RSA / PEM private-key blocks
- GCP service account JSON shapes
- Azure Storage connection strings
- 30+ others

This **complements** ESLint's entropy-based scan — entropy catches
random-looking strings; secretlint catches structured keys that aren't
high-entropy (e.g. some Slack tokens).

`.secretlintignore` narrowly excludes:
```
node_modules/
dist/
.angular/
coverage/
out-tsc/
package-lock.json
test-results/
playwright-report/
```

Everything else is scanned.

**Catch example:** an engineer copy-pastes a real Entra `AZURE_CLIENT_SECRET`
into an `environment.ts` comment while debugging. ESLint entropy might
miss it if the GUID happens to have low-ish entropy; secretlint matches
the `Azure Active Directory client secret` pattern and blocks the commit.

---

## 5 · Architecture & hygiene tooling

### 5.1 `.dependency-cruiser.cjs` — graph-level architecture rules

**Status:** Keep.

ESLint's `import/no-restricted-paths` catches the 90% case inside
`src/app/`. Dependency-cruiser adds rules ESLint can't express:

#### Rule 1 — peer-feature coupling ban
```js
{
  name: 'features-must-not-import-peer-features',
  from: { path: '^src/app/features/([^/]+)/' },
  to:   {
    path:    '^src/app/features/([^/]+)/',
    pathNot: '^src/app/features/$1/'
  }
}
```
The regex back-reference (`$1`) is the magic — ESLint globs can't express
"different feature folder than mine".

#### Rule 2 — no circular dependencies (anywhere in `src/`)
Cycles break tree-shaking, confuse DI ordering, and signal unclear
ownership.

#### Rule 3 — `@env/environment` whitelist
Build-time config may only be read from:
- `config/*`
- `core/observability/telemetry.service.ts`
- `core/observability/global-error-handler.service.ts`
- `core/services/logger.service.ts`
- `core/interceptors/retry.interceptor.ts`
- `core/store/base/store-features/with-devtools.feature.ts` (`environment.production` branch for prod no-op)

Everything else must go through `RUNTIME_CONFIG`. Prevents build-time vs
runtime config drift.

#### Rule 4 — `core/` cannot consume `shared/components`
ESLint zones cover the basics; dep-cruiser also blocks
`core` → `shared/components` (concrete UI primitives) while still allowing
`shared` → `core/services` for cross-cutting infrastructure.

#### Rule 5 — orphan warning
Modules with no incoming or outgoing dependencies are flagged (warning,
not error) — usually a refactoring miss. Legitimate utilities (init-only
modules, `app.routes.ts`, model files re-exported through barrels) are
exempted.

**Run:** `npm run arch:check` (or as part of CI). Output-type `err` makes
it CI-friendly.

---

### 5.2 `.gitignore` — VCS exclusions

**Status:** Keep — but **add `storybook-static/`**.

Covers `dist/`, `node_modules/`, `.angular/cache/`, `coverage/`,
`__screenshots__/`, `/public/config.local.json`, IDE cruft.

**Missing entry:** `storybook-static/` — output of `npm run build-storybook`.
Currently untracked; should be:

```diff
 /.angular/cache
 .sass-cache/
 /connect.lock
 /coverage
+/storybook-static
```

Note the `.vscode/` allowlist pattern — only `settings.json`, `tasks.json`,
`launch.json`, `extensions.json`, `mcp.json` are committed; everything
else under `.vscode/` is ignored. Lets each engineer keep their personal
preferences private while sharing team-relevant editor config.

---

## 6 · Onboarding

### 6.1 `README.md`

**Status:** Keep.

Quick start, tech-stack table, project layout, ports, secrets policy,
phase status. First thing a new engineer reads.

**One staleness note:** the tech-stack row still says
*"Auth: `@azure/msal-angular` (+ BFF cookie mode later)"* — Phase 9
finished, MSAL is gone. Worth a 2-line update.

---

## 7 · Package manifests

### 7.1 `package.json`

**Status:** Required.

Notable settings:
- **`engines.node: '>=22.0.0'`, `engines.npm: '>=10.0.0'`** — pinned;
  prevents the "works on my Node 18" drift.
- **`type: 'module'`** — enables ESM; the flat ESLint config depends on
  this.
- **`packageManager: 'npm@11.8.0'`** — Corepack pins the npm version per
  repo so CI and dev see the same resolver behaviour.

Twenty-plus scripts; key CI anchors:
- `lint` / `lint:fix` — ESLint over `src/**/*.{ts,html}`
- `format` / `format:check` — Prettier over `src/**`
- `test:unit` / `test:unit:coverage` — Vitest with V8 coverage
- `test:e2e` — Playwright
- `arch:check` — Dependency-cruiser
- `secrets:check` — Secretlint full sweep
- `bundle:check` — Production build + size assertions via `scripts/bundle-check.mjs`
- `analyze` — Source-map-explorer over the prod bundle
- `prepare` — `husky` (installs git hooks on `npm install`)

### 7.2 `package-lock.json`

**Status:** Required.

Determinism. Without it, two CI boxes can resolve different transitive
versions of a crypto-adjacent package — which is how supply-chain
compromise happens. Commit it, never hand-edit. Listed in
`.prettierignore` and `.secretlintignore` so its enormous size doesn't
bog down those tools.

---

## 8 · The defence-in-depth chain

Every layer catches a class of bugs the next one misses:

```
1. editor (.editorconfig + .prettierrc)         — style
        ↓
2. tsconfig strict mode                         — type safety
        ↓
3. eslint.config.js                             — correctness, tier rules,
                                                   security, Angular conventions
        ↓
4. lint-staged + husky pre-commit               — gate before commit
   ├─ secretlint                                — leaked structured keys
   ├─ prettier --write                          — auto-format
   └─ eslint --fix --max-warnings=0             — final correctness check
        ↓
5. commitlint commit-msg hook                   — structured history
        ↓
6. Push / PR
        ↓
7. CI: dependency-cruiser (arch:check)          — graph invariants
        ↓
8. CI: vitest run --coverage                    — regression coverage
                                                   (per-tier thresholds)
        ↓
9. CI: playwright test                          — end-to-end (Phase 4+)
        ↓
10. CI: ng build --configuration=production     — bundle-budget enforcement
        ↓
11. CI: bundle:check                            — explicit chunk-size assertions
```

Each step is independently useful, and each closes a different gap:
- **Static analysis (1–3, 7)** catches pattern errors.
- **Test execution (8, 9)** catches behaviour errors.
- **Build-time gates (10, 11)** catch performance regressions.
- **Pre-commit (4, 5)** stops bad commits from leaving the laptop.

Removing any one of them shifts the failure-mode further right (more
expensive to discover, more painful to fix).

---

## 9 · Verdict

**Nothing to delete.** Every config file in `ClientApp/` earns its keep.

**Action items from this audit:**
1. Add `storybook-static/` to `.gitignore`.
2. Refresh the auth row in `README.md` to reflect the post-Phase-9 BFF
   cookie-session model (MSAL is gone).

Both are 30-second changes. Everything else is correctly configured.

---

## 10 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-23 | Claude (Opus 4.7) | Initial deep audit of all config files |
