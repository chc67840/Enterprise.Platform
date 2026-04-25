# Storybook Removal

**Status:** ✅ Completed 2026-04-25.

**Decision:** the team is not adopting component-driven development /
isolated-component review as a process. Storybook was scaffolded earlier
in the project but never integrated into a real workflow — no designer
review loop, no visual-regression CI, no shared-component distribution.
Keeping it installed was pure overhead.

This document captures **what was removed**, **why**, **what we got
back**, and **how to re-introduce it** if a future workflow needs it.

---

## 1 · TL;DR

| Footprint | Before | After |
|---|---|---|
| `node_modules/storybook` + `node_modules/@storybook/*` | ~25 MB | **0 MB** |
| Committed `storybook-static/` build output | 13 MB | **0 MB** |
| `*.stories.ts` source files | 8 | **0** |
| `.storybook/` config files | 4 | **0** |
| `package.json` deps | 5 storybook + `postcss-loader` | **0** |
| `package.json` scripts | 3 storybook scripts | **0** |
| `angular.json` builder targets | 2 | **0** |
| Transitive npm packages | +554 in lockfile | **−554** |
| Build pipelines | esbuild (app) + webpack (Storybook) | esbuild only |

**Net disk reclaim: ~38 MB. Net package reduction: 554 transitive deps.**

Build, lint, and architecture-cruiser are all green post-removal.

---

## 2 · Why we removed it

### 2.1 The four scenarios where Storybook earns its weight

| Scenario | Are we doing it? |
|---|---|
| Distributing a component library to other teams / external consumers | ✗ |
| Designer-engineer collaboration with continuous component review in Storybook | ✗ |
| Visual-regression testing in CI (Chromatic / Percy / Loki) | ✗ |
| Multi-product organisation with shared component packages | ✗ |

When the answer to all four is no, Storybook is dev-overhead with no
matching benefit. The 8 `*.stories.ts` files we did write were
write-and-forget — no review loop ever exercised them.

### 2.2 Concrete costs that went away

- **`npm install` time** dropped (Storybook's transitive tree is large;
  ~554 packages came along for the ride).
- **CVE-tracking surface** shrank by 554 packages — fewer Dependabot
  PRs, fewer transitive supply-chain risks to monitor.
- **Two parallel build pipelines** collapsed to one: Storybook 10 still
  uses webpack 5 internally even though the rest of the app uses esbuild
  via `@angular/build`. The `webpackFinal` hook in `.storybook/main.ts`
  existed *only* to retrofit Tailwind v4 PostCSS into webpack — overhead
  that doesn't exist without Storybook.
- **A fourth tsconfig** (`.storybook/tsconfig.json`) is gone — one
  fewer place strictness can drift.
- **`postcss-loader`** (only needed because of Storybook's webpack
  quirk) is also removed.
- **Cognitive load**: new engineers no longer have to wonder whether
  they're supposed to write `*.stories.ts` files for every shared
  component.

---

## 3 · What was changed (file-by-file)

### 3.1 Deleted directories

| Path | Contents |
|---|---|
| `ClientApp/.storybook/` | `main.ts`, `preview.ts`, `preview.css`, `tsconfig.json` |
| `ClientApp/storybook-static/` | 13 MB of `build-storybook` output that should never have been committed (also missing from `.gitignore`) |

### 3.2 Deleted source files

8 story files under `src/app/shared/`:

- `components/empty-state/empty-state.stories.ts`
- `components/error-state/error-state.stories.ts`
- `components/global-progress-bar/global-progress-bar.stories.ts`
- `components/loading-overlay/loading-overlay.stories.ts`
- `components/page-header/page-header.stories.ts`
- `components/skeleton-card/skeleton-card.stories.ts`
- `components/status-badge/status-badge.stories.ts`
- `design-system/tokens.stories.ts`

The corresponding component files are unchanged — only the stories
sidecars were removed.

### 3.3 `package.json`

Removed scripts:
```diff
-    "storybook": "ng run enterprise-platform-client:storybook",
-    "build-storybook": "ng run enterprise-platform-client:build-storybook",
-    "storybook:test": "test-storybook",
```

Removed devDependencies:
```diff
-    "@storybook/addon-a11y": "^10.3.5",
-    "@storybook/addon-docs": "^10.3.5",
-    "@storybook/angular": "^10.3.5",
-    "@storybook/test-runner": "^0.24.3",
-    "postcss-loader": "^8.2.1",
-    "storybook": "^10.3.5",
```

`postcss-loader` left with the Storybook block because nothing else used
it — only Storybook's webpack chain needed PostCSS injected. Angular's
own builder uses esbuild and processes PostCSS via `.postcssrc.json`.

### 3.4 `angular.json`

Removed two architect targets:
```diff
-        "storybook": {
-          "builder": "@storybook/angular:start-storybook",
-          ...
-        },
-        "build-storybook": {
-          "builder": "@storybook/angular:build-storybook",
-          ...
-        }
```

### 3.5 `.dependency-cruiser.cjs`

Removed the orphan exemption for `*.stories.ts`:
```diff
-          '\\.stories\\.ts$',
```

Also added a related exemption for `*.types.ts` files (consumed via
sibling `index.ts` barrels — same barrel-traversal blind spot as
`core/models/`):
```diff
+          '\\.types\\.ts$',
```

---

## 4 · Verification (all green)

```bash
# Refresh deps
npm install --legacy-peer-deps --no-audit --no-fund
# Result: removed 554 packages

# Production-grade build
npx ng build --configuration=development
# Result: 0 errors, 0 warnings

# Full lint sweep
npx eslint "src/**/*.{ts,html}"
# Result: 0 errors

# Architecture cruiser (124 modules, 190 deps cruised)
npx depcruise --config .dependency-cruiser.cjs --output-type err src
# Result: ✔ 0 violations

# Confirm Storybook is fully purged from node_modules
ls node_modules/@storybook 2>&1
# Result: directory does not exist

ls node_modules/storybook 2>&1
# Result: directory does not exist
```

---

## 5 · How to re-introduce Storybook later (if needed)

If a future workflow requires Storybook (component-library distribution,
designer review loop, visual-regression in CI), here's the path back —
~10 minutes:

```bash
# 1. Install Storybook + Angular framework + addons
npx storybook@latest init --type angular
# This creates .storybook/ with main.ts + preview.ts + tsconfig.json,
# adds the architect targets to angular.json, and adds devDependencies.

# 2. Re-add postcss-loader for the Tailwind v4 webpack chain
npm install --save-dev --legacy-peer-deps postcss-loader

# 3. Wire postcss-loader into .storybook/main.ts via the webpackFinal
#    hook (see git history pre-2026-04-25 for the exact snippet that
#    inserts postcss-loader at the end of each CSS rule's `use` array).

# 4. Re-add the orphan exemption for *.stories.ts files in
#    .dependency-cruiser.cjs
#       '\\.stories\\.ts$',

# 5. Add the build output directory to .gitignore
#       /storybook-static

# 6. Write your first story
#    Author *.stories.ts files alongside the components they document.

# 7. Run it
npm run storybook   # serves http://localhost:6006
npm run build-storybook   # static export
```

The configuration patterns we used the first time (Aura preset
inheritance via the preview, Tailwind v4 webpack PostCSS injection, the
`postcss-loader` workaround) are documented in `feedback_ui_phase5_gotchas.md`
and were proven to work in this codebase — so the second go-round
benefits from those discoveries.

**But before re-installing**, ask: which of the four scenarios in §2.1
applies now? If none, the same overhead returns for the same lack of
benefit. Storybook is the right tool for specific workflows; don't
install it speculatively.

---

## 6 · What we kept that might look related

A few things stayed because they're orthogonal to Storybook:

| Tool | Kept because |
|---|---|
| `@axe-core/playwright` | Used by Playwright E2E for a11y audits. Storybook's `@storybook/addon-a11y` was the redundant copy. |
| Vitest unit tests | Component logic + pure function coverage. Independent of Storybook. |
| Playwright E2E | Real-flow user testing — a different (and complementary) layer to Storybook's component-isolation testing. |
| Tailwind utilities + tokens | UI primitives still need styling; Storybook never owned the styles. |
| `@tailwindcss/postcss` | The Tailwind PostCSS plugin used by Angular's builder — totally separate from `postcss-loader` (which was Storybook-only). |
| All 8 component implementations | Only the `*.stories.ts` sidecars were removed; the components themselves are unchanged. |

---

## 7 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Removed Storybook entirely. ~38 MB disk reclaimed; 554 transitive packages gone; second build pipeline (webpack 5) gone; 4 config files + 8 stories + 5 deps + 3 scripts + 2 architect targets + 2 dep-cruiser entries deleted. Build, lint, dep-cruiser all green post-removal. Re-installation recipe documented for the speculative future case. |
