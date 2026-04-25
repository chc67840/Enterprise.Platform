# PrimeNG Themes → PrimeUIX Migration

**Scope:** the migration from `@primeng/themes` (deprecated) to
`@primeuix/themes` (current) for the Angular SPA's PrimeNG theme system.
Why the package was renamed, the exact files touched, the verification
steps, and the upgrade pattern for future PrimeTek package renames.

**Status:** ✅ Completed 2026-04-25.

**Audience:**
- **New engineers** wondering why two seemingly identical PrimeTek theme
  packages exist (and which to use).
- **Anyone** doing the same migration in a fresh project.
- **Maintainers** following PrimeTek's package-organisation evolution.

**Companion docs:**
- [`UI-Styling-Strategy.md`](./UI-Styling-Strategy.md) — PrimeNG + Tailwind decision
- [`UI-Color-Palette-Strategy.md`](./UI-Color-Palette-Strategy.md) — brand palette wired through PrimeNG preset
- [`UI-Typography-Strategy.md`](./UI-Typography-Strategy.md) — typography tokens
- [`UI-Config-Files-Reference.md`](./UI-Config-Files-Reference.md) — every config file in ClientApp/

---

## 1 · TL;DR

| | Before | After |
|---|---|---|
| Theme engine package | `@primeng/themes ^21.0.4` (**deprecated** on npm) | `@primeuix/themes ^2.0.3` (current) |
| Imports in `primeng.config.ts` | `from '@primeng/themes'` + `from '@primeng/themes/aura'` | `from '@primeuix/themes'` + `from '@primeuix/themes/aura'` |
| `package.json` direct deps | `@primeng/themes` listed | `@primeuix/themes` listed |
| Runtime behaviour | identical | **identical** — pure import swap |
| Bundle size | unchanged | unchanged |
| `ng build` warnings | 0 | 0 |

**Two files changed.** Migration takes ~30 seconds + an `npm install`.

---

## 2 · Why the rename happened

### 2.1 PrimeTek's package consolidation

PrimeTek (the company behind PrimeNG, PrimeReact, PrimeVue) historically
shipped framework-specific theme packages:
- `@primeng/themes` for Angular
- `@primereact/themes` for React
- `@primevue/themes` for Vue

When the Aura theme system landed in v21, PrimeTek extracted the
framework-agnostic theme engine into a single `@primeuix/themes`
package shared across all three frameworks. The framework-specific
packages became thin re-exports pointing at the common engine.

In practice that meant:
- `@primeng/themes` was a **single-line re-export**:
  `export * from '@primeuix/themes';`
- The Angular/React/Vue packages drifted out of sync with the engine over
  time (version mismatches, release lag).

### 2.2 npm-confirmed deprecation

The package's own npm metadata makes the migration call:

```text
npm view @primeng/themes deprecated
"Deprecated. This package is no longer maintained.
 Please migrate to @primeuix/themes:
 https://www.npmjs.com/package/@primeuix/themes"
```

You can verify it yourself in `package-lock.json` at the
`@primeng/themes` entry:

```json
"deprecated": "Deprecated. This package is no longer maintained.
 Please migrate to @primeuix/themes: ..."
```

PrimeTek will continue shipping security patches for `@primeng/themes`
in its lifecycle window, but **all new feature work — new presets,
Aura updates, component palette additions — lands in `@primeuix/themes`
first**. Sticking with the deprecated package means falling behind.

### 2.3 What's identical

The underlying engine is the same code. Both packages export:

| Symbol | Purpose |
|---|---|
| `definePreset(...presets)` | Compose a custom preset on top of a base (e.g. extend Aura with brand colours) |
| `updatePreset(...)` | Mutate the active preset at runtime |
| `updatePrimaryPalette(palette)` | Change `--p-primary-*` tokens on the fly |
| `updateSurfacePalette(palette)` | Change `--p-surface-*` tokens on the fly |
| `usePreset(...)` | Re-apply a saved preset |
| `useTheme(theme)` | Apply a complete theme object |
| `Aura`, `Lara`, `Material`, `Nora` (subpaths) | Built-in preset definitions |

Verified by reading both packages' `index.d.mts` files — the type
signatures are identical. The migration is purely cosmetic at the
import level.

### 2.4 The new ownership chain

```
@primeuix/themes        ← THIS is what you import
       │
       ▼
@primeuix/styled        ← style-injection runtime, framework-agnostic
       │
       ├──► PrimeNG components (read CSS vars at runtime)
       ├──► PrimeReact components
       └──► PrimeVue components
```

Aura, Lara, Material, Nora preset definitions live under
`@primeuix/themes/<name>` — same structure as the old
`@primeng/themes/<name>` namespace. No preset names changed.

---

## 3 · The migration — step by step

### 3.1 Step 1 — verify the new package is in `node_modules`

`@primeuix/themes` was already a transitive dependency of
`@primeng/themes` (which itself depended on the engine). Running
`npm ls @primeuix/themes` before the migration showed it sitting in the
tree as an indirect.

If you're starting from a different baseline, install it first:

```bash
npm install @primeuix/themes --legacy-peer-deps
```

The `--legacy-peer-deps` flag is project policy for any install — see
`feedback_ui_phase2_gotchas.md` for the eslint-10 peer-dep rationale.

### 3.2 Step 2 — find every reference

```bash
# Run from ClientApp/
grep -rn "@primeng/themes" --include="*.ts" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=dist .
```

In our codebase the matches were exactly 4:

| File | Lines | Action |
|---|---|---|
| `src/app/config/primeng.config.ts` | 33, 34 | Edit imports |
| `src/app/config/primeng.config.ts` | 31 (comment) | Update doc reference |
| `package.json` | 53 | Replace dependency entry |
| `package-lock.json` | (regenerated) | Auto-refresh via `npm install` |

If your project uses themes in other places (e.g. a tenant theme switcher
calling `updatePrimaryPalette` from a component), update those imports
too. The find-all-occurrences pattern above catches them.

### 3.3 Step 3 — edit `primeng.config.ts`

```diff
-import { definePreset } from '@primeng/themes';
-import Aura from '@primeng/themes/aura';
+import { definePreset } from '@primeuix/themes';
+import Aura from '@primeuix/themes/aura';
 import type { PrimeNGConfigType } from 'primeng/config';
```

Two-line change. The component-level usage of `definePreset(Aura, {...})`
is **byte-identical** because the function signature is the same.

The header comment in the file is also updated to point engineers at the
new package name when they read it later. (See the file's actual
contents post-migration.)

### 3.4 Step 4 — update `package.json`

```diff
   "dependencies": {
     ...
     "@ngrx/signals": "^21.0.1",
-    "@primeng/themes": "^21.0.4",
+    "@primeuix/themes": "^2.0.3",
     "chart.js": "^4.5.1",
     ...
   }
```

Note the **version-number reset**: `@primeuix/themes` is on its own
semver track (`^2.x`) — it does NOT mirror PrimeNG's `^21.x`. PrimeNG's
component package (`primeng`, still v21) and the underlying theme engine
(`@primeuix/themes`, v2) are independently versioned now that they're
decoupled.

### 3.5 Step 5 — refresh the lockfile

```bash
npm install --legacy-peer-deps --no-audit --no-fund
```

Output should report: `removed 1 package` (the deprecated
`@primeng/themes` direct entry; transitives stay in tree). If you see a
larger remove count, something else changed too — investigate before
proceeding.

### 3.6 Step 6 — verify

```bash
# 1. Build clean
npx ng build --configuration=development
# Expected: bundle generation complete, 0 warnings

# 2. Lint clean
npx eslint "src/**/*.{ts,html}"
# Expected: 0 errors

# 3. Hard reload the dev server
npm run start
# Open http://localhost:4200, hard-refresh (Ctrl+Shift+R)
# Verify: PrimeNG components (drawer, menu, popover, buttons) render with
# the brand-tinted Aura preset — colours, focus rings, hover states all
# look exactly the same as before the swap.

# 4. (Optional) Verify the deprecated package is fully gone
ls node_modules/@primeng/
# Expected: empty (the @primeng/ namespace folder shouldn't exist)

ls node_modules/@primeuix/
# Expected: themes, styled, motion, styles, utils
```

---

## 4 · Files that did NOT need to change

A few callouts that might surprise readers:

| File | Why no change |
|---|---|
| `primeng` (the components package) | Independent of the theme engine; still on v21.x |
| `primeicons` | Icon font; orthogonal to the theme system |
| `src/app/config/app.config.ts` | Already imports `providePrimeNG` from `primeng/config` (which is the components package) — no theme import here |
| `src/styles.css` + `src/styles/tokens.css` | Theme tokens live in our own CSS variables; the PrimeNG preset reads `var(--ep-color-…)` at runtime via the `definePreset` call. The pipeline is unchanged. |
| Any component that uses `pButton`, `p-menu`, `p-drawer` etc. | Components consume the theme via runtime CSS var resolution — no source change needed |
| `tailwind` / `@tailwindcss/postcss` | Tailwind doesn't know or care about which theme engine package is wiring PrimeNG |
| `cssLayer.order: 'theme, base, primeng, utilities'` | Layer name is `'primeng'` — just a string identifier owned by our `primeNgConfig`. No relation to the package name. |

The migration's blast radius is exactly the two import lines plus the
package declaration. Everything else flows through CSS variables.

---

## 5 · Why the PrimeTek docs (and some tutorials) still show `@primeng/themes`

PrimeNG's official docs site continues to show `@primeng/themes` import
examples in some "Theming" pages because:

1. The docs aren't fully refreshed yet for the package consolidation.
2. The deprecation is "soft" — `@primeng/themes` still works as a thin
   re-export.
3. PrimeTek wants to avoid breaking existing tutorial links.

When you encounter `@primeng/themes` in PrimeNG docs, treat it as
synonymous with `@primeuix/themes`. The new package is the canonical
home; the old one is a compatibility shim until removed entirely.

---

## 6 · The pattern for future PrimeTek renames

If/when PrimeTek introduces another deprecated-then-renamed package
(common with consolidation efforts), the recipe is:

1. **Run `npm view <oldpkg> deprecated`** — confirm the npm metadata
   officially marks it as deprecated and names the successor.
2. **Compare the `index.d.mts` files** of both packages — confirm the
   type surface is identical (or compatible). If not, treat the
   migration as a real refactor, not a swap.
3. **Audit references** with `grep -rn "<oldpkg>" --include="*.ts" --include="*.json"`.
4. **Find/replace** the imports.
5. **Update `package.json`** + `npm install --legacy-peer-deps`.
6. **`ng build` + `npm run lint` + spot-check**.
7. **Document** — short ADR-style note in `Docs/Architecture/`.

For purely cosmetic renames (re-export packages), this pattern stays at
~30 seconds of work + 5 minutes of verification. For actual API changes,
the same pattern still surfaces the change list — but the `find/replace`
step becomes a real refactor.

---

## 7 · What this migration is NOT

A few things to set expectations:

- **Not a major Aura update** — the Aura preset itself is unchanged;
  what's brand-tinted via `definePreset` continues to work.
- **Not a runtime perf change** — the engine is the same code; bundle
  size + injection timing are identical.
- **Not a CSS layer change** — `cssLayer.order` is unaffected.
- **Not a Tailwind v4 interaction change** — the
  `theme, base, primeng, utilities` layer order still applies (see
  `feedback_primeng_csslayer_tailwind_v4.md`).
- **Not a PrimeNG component upgrade** — `primeng` package version stays
  at `^21.x` independently.
- **Not a React/Vue concern** — the migration is Angular-only because
  the theme engine is Angular-agnostic; we just swap the import path.

---

## 8 · Verification checklist (post-migration)

```bash
# Compile cleanly
npx tsc -p tsconfig.app.json --noEmit
# Expected: 0 errors

# Production build with bundle budgets
npx ng build --configuration=production
# Expected: under-budget on initial chunk; 0 warnings

# Lint
npx eslint "src/**/*.{ts,html}"
# Expected: 0 errors

# Run the dev server
npm run start
# Open http://localhost:4200, hard-refresh

# Visual smoke test — confirm:
#   ✓ Top-nav drawer (TopNavWithSidebarComponent) renders styled
#   ✓ Drawer items have hover/active blue tint
#   ✓ User-menu popover has elevated panel + dividers
#   ✓ Notification-popover bell badge is red-bg
#   ✓ Buttons (Test now, etc.) are indigo brand
#   ✓ Focus rings on inputs/buttons are indigo
#   ✓ Theme toggle (light/dark/system) flips both Tailwind utilities AND
#     PrimeNG components together

# Confirm @primeng/themes is fully purged
ls node_modules/@primeng/
# Expected: directory does not exist OR is empty

# Confirm @primeuix/themes is the only theme engine
grep '"@primeng/themes"\|"@primeuix/themes"' package-lock.json | sort -u
# Expected: only @primeuix/themes lines
```

---

## 9 · Rollback (if needed)

If a regression appears that traces back to the package swap:

1. Re-apply the inverse diff to `primeng.config.ts` and `package.json`.
2. `npm install --legacy-peer-deps`.
3. `ng build` to confirm.
4. File a PrimeNG issue with the regression details — likely a real bug
   in `@primeuix/themes` worth reporting upstream.

In the migration window we did NOT find any behavioural difference, so
rollback isn't expected to be needed.

---

## 10 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Migrated `@primeng/themes ^21.0.4` (deprecated) → `@primeuix/themes ^2.0.3`. Two import lines changed in `src/app/config/primeng.config.ts`; one entry in `package.json`. `npm install` removed 1 package; `ng build` clean. No runtime / styling / bundle change. |
