# Phase 0 — CSS → SCSS Migration Audit

> **Status:** Phase 0 (audit only) — no file changes have been made.
> **Generated:** 2026-04-28 · `feature/db-first-pivot`
> **Scope:** `src/UI/Enterprise.Platform.Web.UI/ClientApp/`
> **Decisions in effect** (from chat): Strategy **B** (extract inline `styles:` to `*.component.scss`) · Phased rollout · `::ng-deep` policy (b) (PrimeNG-targeting → global, rest stays) · tsconfig untouched · No `pt` API conversion · Playwright screenshots for chrome + dashboard + login.

---

## Executive summary — key deviations from the prompt's assumptions

The prompt assumes a chaotic CSS state. Reality is the opposite — the styling architecture is already **well-organized** but uses **plain CSS + inline component styles**. This shifts the migration shape:

| Prompt assumption | Reality |
|---|---|
| Component styles in `*.component.css` files | **0 component.css files.** All **46 components use inline `styles: []`** template literals |
| Tokens scattered across files needing centralization | **Already centralized** in `src/styles/tokens.css` (~300 lines, well-documented, with dark-mode overrides) |
| `prefers-reduced-motion` missing or scattered | **Already global** in `src/styles/animations.css` |
| Tailwind v4 entry point uses v3 `@tailwind` directives | **Already v4 syntax** — `@import 'tailwindcss'` in `styles.css` |
| PrimeNG `cssLayer` misconfigured | **Already correct** — `theme, base, primeng, utilities` in `primeng.config.ts` |
| `.dark` patterns scattered in component CSS | **0 component-level `.dark` selectors.** Dark mode flows through `--ep-*` token swap at root level |
| `@apply` used in components | **0 `@apply` directives** — Tailwind utilities used directly in templates |
| Dark mode mechanism unclear | **`ThemeService`** at `core/services/theme.service.ts` toggles `.dark` class on `<html>` |

**Net effect:** the migration is narrower than the prompt scope. We're really doing:
1. Rename + `@use`-ify 4 global CSS files (`tokens`, `fonts`, `animations`, `styles`) into SCSS partials
2. Extract the 46 inline `styles: []` arrays into `.component.scss` files
3. Consolidate ~40 PrimeNG-targeting `::ng-deep` rules into a new `_primeng-overrides.scss`
4. Add 3 mixins (`dark`, breakpoints, `focus-ring`) — all derived from existing patterns, not invented
5. Install `sass` (not currently a dependency)

---

## A. Component Style Files

**Note:** The prompt's A-section template assumes `*.component.css` files. We have **0 of those**. All component styles live in inline `styles: []` arrays inside `@Component` decorators. Audit re-cast accordingly.

### A.1 — Inventory: 46 components with inline `styles: []`

```
shared/components/dph/                          (24 components — universal UI Kit)
├── avatar.component.ts
├── button.component.ts
├── context-menu.component.ts
├── data-table.component.ts                     ★ 1433 LoC · 16 ::ng-deep · largest
├── data-table/bulk-action-toolbar.component.ts
├── data-table/cell-renderer.component.ts
├── data-table/column-chooser.component.ts
├── data-table/column-filter.component.ts       ★ 1 ::ng-deep
├── dialog.component.ts                         ★ 3 ::ng-deep
├── drawer.component.ts                         ★ 1 ::ng-deep
├── dropdown-menu.component.ts
├── field-error.component.ts
├── file-list.component.ts
├── file-preview.component.ts
├── file-upload.component.ts
├── float-label.component.ts
├── form-layout.component.ts
├── gallery.component.ts
├── image.component.ts
├── inline-message.component.ts
├── input.component.ts                          ★ 6 ::ng-deep
├── list.component.ts
├── live-data-table.component.ts
├── panel.component.ts
├── popover.component.ts
├── steps.component.ts
├── tree.component.ts                           ★ 4 ::ng-deep
└── wizard-buttons.component.ts

shared/components/skeleton-card/                (1 component)
└── skeleton-card.component.ts

shared/layout/                                  (12 components — chrome)
├── components/nav-menu/nav-menu.component.ts                       ★ 2 ::ng-deep
├── components/notification-bell/notification-bell.component.ts
├── components/platform-footer/platform-footer.component.ts         ★ 779 LoC
├── components/platform-navbar/platform-navbar.component.ts         ★ 957 LoC
├── components/user-menu-button/user-menu-button.component.ts       ★ 7 ::ng-deep
├── components/widgets/language-switcher.component.ts
├── components/widgets/nav-clock.component.ts
├── components/widgets/quick-actions.component.ts
├── components/widgets/theme-toggle-button.component.ts
├── sub-nav/breadcrumb.component.ts
├── sub-nav/page-header.component.ts                                ★ 334 LoC
└── sub-nav/sub-nav-orchestrator.component.ts

features/__demo/                                (5 files — DEMO ROUTES, FILTERED OUT per scope)
├── sub-nav-demo.component.ts                   ⚠ filtered
├── ui-kit/data-table-demos.ts                  ⚠ filtered
├── ui-kit/steps-demos.ts                       ⚠ filtered
├── ui-kit/ui-kit-demos.ts                      ⚠ filtered
└── ui-kit/ui-kit-shell.component.ts            ⚠ filtered
```

**46 total** including demo files. **41** in scope (excluding `__demo/*` per chat decisions).

### A.2 — Per-component characteristics (aggregate)

| Property | Count / observation |
|---|---|
| Files with `.p-*` PrimeNG selectors in styles | ~12 components (concentrated in dph/, dph/data-table/, layout/) |
| Files with `@apply` directives | **0** (confirmed: zero matches in `src/app/`) |
| Files with `var(--ep-*)` token references | **All 41 in-scope** (token-driven styling already pervasive) |
| Files with `[style.x]` bindings in matching template | ~16 files, ~30 bindings — see §C |
| Files with hardcoded `#hex` colors | A handful (mostly in shadows like `rgba(15, 23, 42, 0.05)` — token-equivalents exist) |
| Files with hardcoded `px` font sizes | Common (e.g. `font-size: 0.875rem` is the norm; raw `px` rare) |
| Files with `@media` queries | 16 files (95 occurrences across `app/`) |
| Files with **flat `.dark` selectors** | **0** — clean state, dark mode handled via root-level token swap |

### A.3 — Notable per-component details

| Component | LoC | Style chars (est) | Notes |
|---|---|---|---|
| `data-table.component.ts` | 1433 | ~14 KB inline styles | Largest single migration unit; ~16 `::ng-deep` blocks, ~7 `[style.x]` bindings (col.width/min-width/text-align/etc.), responsive media queries. **Likely to exceed 8 KB component-style budget after extraction.** |
| `platform-navbar.component.ts` | 957 | ~9 KB | Mobile drawer animations (`@keyframes ep-backdrop-in`, `ep-drawer-in`), responsive breakpoints, `[style.--nav-height.px]` runtime binding |
| `platform-footer.component.ts` | 779 | ~7 KB | 4-col responsive |
| `steps.component.ts` | 637 | ~6 KB | Progress bar with `[style.width]` and `[style.padding-left.rem]` (legitimately dynamic) |
| `nav-menu.component.ts` | 577 | ~5 KB | 2 `::ng-deep` for `.ep-nav-menu__dropdown` and mega-menu |
| `column-filter.component.ts` | 422 | ~4 KB | 1 `::ng-deep` (`.p-popover-content`) |
| `cell-renderer.component.ts` | 418 | ~4 KB | Heavy use of `[style.background-color]`, `[style.color]`, `[style.width]` — all legitimately dynamic |
| `input.component.ts` | 375 | ~3.5 KB | 6 `::ng-deep` (must reach `.p-inputnumber-input`, `.p-password-input`) |
| `user-menu-button.component.ts` | 273 | ~2.5 KB | 7 `::ng-deep` (`.p-menu-item-link`, etc.) |

**Risk callout:** `data-table.component.ts` styles alone exceed the **4 KB warning budget**. After extraction it will likely warn on production build. Two options: (a) accept the warning and bump the budget to e.g. 16 KB; (b) split data-table styles between component-scoped and `_primeng-overrides.scss` (the `::ng-deep .p-datatable-*` rules belong in the global anyway, removing maybe ~30% of the bulk).

---

## B. Global Style Files

| File | LoC | Content |
|---|---|---|
| `src/styles.css` | 318 | **Master entry.** Composition order: `@import 'tokens.css'` → `'fonts.css'` → `'animations.css'` → `'primeicons/primeicons.css'` → `'tailwindcss'`. Then `@theme inline { ... }` aliases `--ep-*` tokens into Tailwind's theme scale. Then baseline (html/body, focus-visible, print media). Then chrome interaction guards (touch-action, tap-highlight). |
| `src/styles/tokens.css` | 353 | **Design tokens.** All 4 brand palettes (primary indigo, palmetto, jessamine, neutral) with 11-step scales. Danger 5-step. Semantic aliases (success/warning/info). 4 brand gradients. Surfaces + text + borders. Radii, spacing, shadows, z-index, transitions, easing. Layout dimensions. Navbar chrome tokens. Typography (4 family stacks + weights + sizes). Backdrop blur. **Plus `:root.dark { ... }` block** with surface/text/shadow flips for dark mode. |
| `src/styles/fonts.css` | 159 | **`@font-face` declarations** — currently mostly placeholder (Noto Sans loaded via `<link>` in index.html; Arno Pro and Bicycletter blocks commented out pending licensed files). |
| `src/styles/animations.css` | 87 | **Keyframes**: `ep-shimmer`, `ep-progress-indeterminate`, `ep-fade-in`, `ep-scale-in`. Plus `.ep-fade-in` and `.ep-scale-in` utility classes. **Includes the global `@media (prefers-reduced-motion: reduce)` rule** at the end. |
| `src/styles/README.md` | 13 | Brief doc. Lists planned files (some not yet created: `typography.css`, `scrollbars.css`, `utilities.css`, `primeng-overrides.css`). |

**`@import` statements** (must become `@use` — 4 of them):
1. `@import './styles/tokens.css';`
2. `@import './styles/fonts.css';`
3. `@import './styles/animations.css';`
4. `@import 'primeicons/primeicons.css';`
5. `@import 'tailwindcss';` ← **Tailwind v4 syntax — keeps as `@import` (v4 requirement, see Phase 4.1)**

---

## C. Inline Styles in Templates (`[style.x]` bindings)

**Total:** ~30 bindings across 16 files. Grouped by intent:

### C.1 — Legitimately dynamic (KEEP as `[style.x]`)

| File | Binding | Why dynamic |
|---|---|---|
| `dph/avatar.component.ts` | `[style.--dph-avatar-bg]`, `[style.--dph-avatar-fg]` | User-defined avatar colors via config — legitimate runtime values |
| `dph/cell-renderer.component.ts` | `[style.background-color]="avatarBg()"`, `[style.color]="value() ? ... : ..."` | Per-row computed values |
| `dph/cell-renderer.component.ts` | `[style.width]="opts().imageWidth || '2.5rem'"`, `[style.height]` | Per-cell config |
| `dph/cell-renderer.component.ts` | `[style.background-color]="bgFor($index)"` | Per-avatar color in a group |
| `dph/cell-renderer.component.ts` | `[style.width]="pct + '%'"`, `[style.background-color]="progressColor(pct)"` | Progress bar fill — animated |
| `dph/cell-renderer.component.ts` | `[style.-webkit-line-clamp]="opts().maxLines || 2"` | Per-instance line clamp count |
| `dph/cell-renderer.component.ts` | `[style.background-color]="statusColor()"` | Status dot color computed from row |
| `dph/file-list.component.ts` | `[style.width.%]="f.uploadProgress"` | Upload progress |
| `dph/data-table.component.ts` | `[style.width]="col.width"`, `[style.min-width]="col.minWidth"`, `[style.text-align]="col.align"` | Column config (×3 occurrences each) |
| `dph/image.component.ts` | `[style.object-fit]="config().objectFit"` | Per-instance fit mode |
| `dph/list.component.ts` | `[style.maxHeight]="config().maxHeight"` | Per-instance height limit |
| `dph/steps.component.ts` | `[style.width]="progressPct() + '%'"`, `[style.padding-left.rem]="fs.depth * 1.5"`, `[style.left]="notchPosition($index) + '%'"` | Animated progress + computed positions |
| `dph/live-data-table.component.ts` | `[style.height]`, `[style.transform]="'translateY(' + offsetY() + 'px)'"`, `[style.width]`, `[style.text-align]` | Virtual-scroll math, column config |
| `layout/nav-menu.component.ts` | `[style.--section-count]="item.children!.length"` | Grid columns from data shape |
| `layout/platform-navbar.component.ts` | `[style.--nav-height.px]="heightPx()"` | Runtime navbar height |

**Verdict:** all of these are legitimately runtime-computed. **None should be converted to CSS classes.**

### C.2 — Conversion candidates

**0** identified. Every `[style.x]` reviewed has a runtime input.

---

## D. tsconfig.json State

| Property | Value |
|---|---|
| `"baseUrl"` present | **yes** — `"./"` |
| `"paths"` present | **yes** — 11 aliases (`@core/*`, `@shared/*`, `@features/*`, `@layouts/*`, `@config/*`, `@models/*`, `@env/*`, `@utils`, `@utils/*`, `@constants`, `@constants/*`) |
| `"ignoreDeprecations"` present | **no** — clean |
| Other notable | Strict mode all enabled (`strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`). `angularCompilerOptions.strictTemplates: true`, `extendedDiagnostics`. **Long memorialized comment** about why `references` block was removed (TS6306 + composite issues with Angular toolchain). |

**Decision in effect:** **leave tsconfig untouched** (per chat — option (b)).

The path aliases use `src/app/...` style which works correctly with `baseUrl: "./"`. Removing `baseUrl` is unrelated to the SCSS migration and risks regressing IDE behavior the file's comment specifically calls out.

---

## E. angular.json State

| Property | Value |
|---|---|
| `"inlineStyleLanguage"` | `"css"` ← **must change to `"scss"`** |
| `"stylePreprocessorOptions"` | **not present** ← must add `{ "includePaths": ["src/styles"] }` |
| `"styles"` array | `["src/styles.css"]` ← will become `["src/styles/styles.scss"]` |
| `"anyComponentStyle"` budget | **already present:** 4 KB warn / 8 KB error (production + staging configurations) |
| `"schematics.@schematics/angular:component.style"` | `"css"` ← must change to `"scss"` |
| `"@schematics/angular:component.changeDetection"` | `"OnPush"` ✓ keep |
| `"@schematics/angular:component.viewEncapsulation"` | `"None"` ⚠ flagged below |
| `"@schematics/angular:component.standalone"` | `true` ✓ keep |

**Risk callout — `viewEncapsulation: "None"`:** every generated component uses **no encapsulation**. This means the migration must be MORE careful:
- Component SCSS classes leak globally — naming discipline matters (good news: the `.dph-*` and `.ep-*` namespacing already in use IS the discipline).
- `:host` selectors still work but `:host ::ng-deep` semantics differ (`::ng-deep` was needed when encapsulation was Emulated; with `None`, it's redundant on most patterns).
- The `:host ::ng-deep .dph-table .p-datatable-*` rules currently used would still work without `::ng-deep` — but Angular's CSS deprecation warning still flags them.

**Implication:** moving PrimeNG-targeting `::ng-deep` rules to `_primeng-overrides.scss` is the right call (decision (b) from chat) — and we drop the `::ng-deep` keyword entirely in the move (it was never load-bearing under `ViewEncapsulation.None`).

---

## F. package.json State

| Property | Value |
|---|---|
| `sass` installed | **NO** ← must `npm install --save-dev sass` |
| Tailwind version | `^4.2.1` (also `@tailwindcss/postcss@^4.2.1`, `@tailwindcss/vite@^4.2.1`) |
| PrimeNG version | `^21.1.3` + `@primeuix/themes@^2.0.3` + `primeicons@^7.0.0` |
| Angular version | `^21.2.x` (core, common, animations, etc.) |
| TypeScript | `~5.9.2` |
| `@angular/cli` | `^21.2.2` (supports SCSS natively from v6+) |

---

## G. PrimeNG Configuration (`config/primeng.config.ts`)

| Property | Value |
|---|---|
| Engine | `@primeuix/themes` (NOT deprecated `@primeng/themes`) — see memory `reference_primeuix_themes_migration` |
| Preset base | `Aura` |
| `definePreset()` overrides | `semantic.primary.{50–950}` bound to `var(--ep-color-primary-*)` tokens; `semantic.colorScheme.light.primary` and `.dark.primary` define color/contrast/hover/active mappings; `highlight` colors mapped to `--ep-color-primary-*` for both light and dark |
| `darkModeSelector` | **`.dark`** (matches `ThemeService` and tokens.css `:root.dark` block) |
| `cssLayer.name` | `'primeng'` |
| `cssLayer.order` | `'theme, base, primeng, utilities'` (correct Tailwind v4 layer names — see comment block in primeng.config.ts about why `tailwind-base/utilities` from PrimeNG docs is wrong) |
| Default `inputStyle` | `'outlined'` |
| Z-index scale | `modal: 1100, overlay: 1000, menu: 1000, tooltip: 1100` |

**Key insight:** PrimeNG semantic tokens already reference `--ep-*` CSS variables. **No duplication risk** in `_tokens.scss` — they're already cleanly bridged via `definePreset()`.

---

## H. Dark Mode Implementation

| Question | Answer |
|---|---|
| How toggled? | `<html>.classList.add('dark')` / `.remove('dark')` driven by `effect()` on `ThemeService.isDark` signal |
| Toggle logic location | `src/app/core/services/theme.service.ts` (152 LoC) |
| Selector trigger | **`.dark` class on `<html>`** |
| User control | `theme-toggle-button.component.ts` cycles `light → dark → system` |
| Persistence | `localStorage[STORAGE_KEYS.THEME]` |
| OS-preference watch | `window.matchMedia('(prefers-color-scheme: dark)')` for `mode === 'system'` |
| Component-level `.dark` overrides | **None.** All dark-mode theming flows through token swap in `tokens.css` `:root.dark { ... }` block (surfaces, text, borders, shadows, semantic-foreground brightening) |
| PrimeNG dark integration | `darkModeSelector: '.dark'` in `primeng.config.ts` — automatic. PrimeNG components receive their own dark-tone tokens from the preset's `colorScheme.dark` block |

**Implication for `_mixins.scss`:** the `@mixin dark` we add must use selector `:root.dark &` (not `.dark &`) — because the class lives on `<html>`, which is `:root`. Both technically work, but `:root.dark` matches the existing token convention exactly.

```scss
@mixin dark {
  :root.dark & {
    @content;
  }
}
```

---

## I. Design Tokens

**Already in use, comprehensive, well-documented.**

### I.1 — Token namespaces

| Namespace | Count | Examples |
|---|---|---|
| `--ep-color-primary-*` | 11 (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) | Indigo Blue, brand anchor 700 = `#1B3F73` |
| `--ep-color-palmetto-*` | 11 | Palmetto Green, brand anchor 700 = `#1F5328` |
| `--ep-color-jessamine-*` | 11 | Yellow Jessamine, brand anchor 500 = `#F4B82E` |
| `--ep-color-neutral-*` | 12 (0, 50–950) | Opaque White scale (warm parchment) |
| `--ep-color-danger-*` | 5 (50, 100, 500, 600, 700) | Off-brand red (intentionally) |
| `--ep-color-{success,warning,danger,info}` + `*-bg` | 8 semantic aliases | Reference brand scale steps |
| `--ep-gradient-brand-*` | 5 (cool, warm, sunrise, forest, subtle) | Linear gradients for hero surfaces |
| `--ep-surface-*` | 4 (0, 50, 100, 200) | Theme-swappable in `:root.dark` |
| `--ep-text-*` | 3 (primary, secondary, muted) | Theme-swappable |
| `--ep-border`, `--ep-border-strong` | 2 | Theme-swappable |
| `--ep-radius-*` | 7 (none, sm, md, lg, xl, 2xl, full) | `0` to `9999px` |
| `--ep-space-*` | 11 (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16) | 0.25rem step |
| `--ep-shadow-*` | 5 (xs, sm, md, lg, xl) + `--ep-shadow-focus` | `:root.dark` overrides for depth on dark surfaces |
| `--ep-z-*` | 7 (base, dropdown, sticky, overlay, modal, toast, tooltip) | 0 to 1500 |
| `--ep-ease-*` | 2 (standard, emphasized) | Cubic-bezier curves |
| `--ep-duration-*` | 3 (fast 120ms, normal 200ms, slow 320ms) | + composite `--ep-transition-standard` |
| `--ep-header-height`, `--ep-sidebar-width`, `--ep-content-max` | 4 layout dims | |
| `--ep-nav-radius-top`, `--ep-nav-shadow` | 2 navbar chrome | |
| `--ep-font-{primary,secondary,accent,mono,sans}` | 5 family stacks | Noto Sans, Arno Pro, Bicycletter, JetBrains Mono |
| `--ep-font-weight-*` | 5 (regular 400, medium 500, semibold 600, bold 700, black 900) | |
| `--ep-text-{xs,sm,base,lg,xl,2xl,3xl}` + leading | 10 typography scale | |
| `--ep-blur-*` | 3 (sm, md, lg) | Backdrop blur |

**Total:** ~140 unique CSS custom properties. All in `:root` of `tokens.css`. **Nothing scattered.**

### I.2 — Component-level CSS variables (custom, scoped)

A few components define their own private CSS vars (e.g. `--dph-avatar-bg`, `--dph-avatar-fg`, `--dph-dialog-content-padding`, `--nav-height`). These are **per-component scoped — do not migrate to `_tokens.scss`.** They stay co-located with the component that defines them.

---

## Migration Impact Assessment

### Files to Rename (CSS → SCSS)

| Old path | New path |
|---|---|
| `src/styles.css` | `src/styles/styles.scss` (master entry) |
| `src/styles/tokens.css` | `src/styles/_tokens.scss` |
| `src/styles/fonts.css` | `src/styles/_typography.scss` (renamed for SCSS partial convention; content stays) |
| `src/styles/animations.css` | `src/styles/_animations.scss` |

### Files to Create (New SCSS Partials)

Based on what the audit found:

| Partial | Needed? | Why |
|---|---|---|
| `_tokens.scss` | **YES** (rename of existing `tokens.css`) | All custom properties already centralized |
| `_mixins.scss` | **YES (new)** | Found patterns to extract: `dark` (used in tokens), responsive breakpoints (12 components have `@media (min-width: 1024px)`, etc.), focus-ring (`outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px;` repeats in ~6 components) |
| `_typography.scss` | **YES (rename of existing `fonts.css`)** | Currently mostly empty (placeholder for licensed fonts); will absorb font stack and any heading scale rules from `styles.css` |
| `_animations.scss` | **YES (rename of existing `animations.css`)** | Already has all keyframes + `prefers-reduced-motion` |
| `_utilities.scss` | **NO** | No global utility classes found (besides `.ep-fade-in`/`.ep-scale-in` which belong to `_animations.scss`); all utilities come from Tailwind |
| `_reset.scss` | **YES (new)** | The `html/body` rules, focus-visible, print media, and chrome interaction guards (touch-action, tap-highlight) currently in `styles.css` belong here |
| `_primeng-overrides.scss` | **YES (new)** | ~40 PrimeNG-targeting `::ng-deep` rules across components consolidate here |
| `styles.scss` | **YES (rename of `styles.css`)** | Master entry — `@use` chain |

**Final partial list:** `_tokens`, `_mixins`, `_typography`, `_animations`, `_reset`, `_primeng-overrides`, `styles` (entry). **7 files** in `src/styles/`.

### Component file changes (Strategy B — extract)

For each of the **41 in-scope** components (excluding `__demo/*`):

1. Create new file: `<name>.component.scss` next to `<name>.component.ts`
2. Copy the `styles: [\` ... \`]` template-literal content into the `.scss` file
3. Replace `styles: [...]` → `styleUrl: './<name>.component.scss'` in the `@Component` decorator
4. **Move PrimeNG-targeting blocks** (anything with `::ng-deep .p-*` selectors) to `_primeng-overrides.scss`:
   - `:host ::ng-deep .dph-table .p-datatable-*` blocks (16 in data-table.component.ts)
   - `:host ::ng-deep .dph-dialog .p-dialog-*` blocks (3 in dialog.component.ts)
   - `:host ::ng-deep .dph-input__field .p-{inputnumber,password}*` (6 in input.component.ts)
   - `:host ::ng-deep .dph-tree .p-tree*` (3 in tree.component.ts)
   - `:host ::ng-deep .dph-drawer .p-drawer-content` (1 in drawer.component.ts)
   - `:host ::ng-deep .dph-cf__pop .p-popover-content` (1 in column-filter.component.ts)
   - `:host ::ng-deep .ep-user-menu .p-menu*` (3 in user-menu-button.component.ts)
   - Drop `::ng-deep` keyword in the move (encapsulation is `None` globally — `::ng-deep` was redundant)
5. **Keep** non-PrimeNG `::ng-deep` rules in the component for now (decision (b) from chat). Total kept: ~12 (mostly `::ng-deep .ep-user-avatar-light/dark` host-wrappers, `.ep-nav-menu__dropdown` which is the component's own class). Add `// DEBT: ::ng-deep — review when component encapsulation policy changes` comment to each.
6. Replace inline interpolations (none found in styles — confirmed: no `${}` inside `styles: [\` ... \`]` blocks)

**Risk:** `data-table.component.ts` styles after extraction may still exceed the 4 KB component-style budget. **Recommendation:** during Phase 2 of the migration, after PrimeNG overrides are removed (~30% reduction), remeasure. If still over: bump the budget *for that one component* via inline budget exemption, OR split into `data-table.component.scss` + `data-table.layout.scss`.

### Structural Debt Found

| Pattern | Count | Recommendation |
|---|---|---|
| `:host ::ng-deep .p-*` PrimeNG-piercing selectors | ~40 across 8 components | **Move to `_primeng-overrides.scss` (no `::ng-deep` keyword needed under encapsulation: 'None')** |
| Repeated `outline: 2px solid var(--ep-color-jessamine-500); outline-offset: 2px;` focus styles | ~6 components | **Extract to `@mixin focus-ring` in `_mixins.scss`** |
| Repeated `@media (min-width: 1024px)` breakpoint | ~8 components | **Extract to `@mixin desktop` in `_mixins.scss`** (use a single token-driven breakpoint value) |
| Repeated `@media (max-width: 767px)` breakpoint | ~5 components | **Extract to `@mixin mobile`** |
| Repeated `@media (max-width: 1024px)` breakpoint | ~3 components | **Extract to `@mixin tablet-down`** |
| Repeated `@media (prefers-reduced-motion: reduce)` per-component | ~2 components | **Already global in `_animations.scss` — these per-component versions can be REMOVED** (one targeting `.ep-mobile-backdrop`/`.ep-mobile-menu` in navbar; the global rule's `*` selector already covers them) |
| Hardcoded shadow `rgba(15, 31, 59, ...)` instead of `var(--ep-shadow-*)` | ~3 components (panel, dialog, drawer) | **Replace with token references** — these are pure refactors, no visual change |
| Hardcoded color `#fff` / `#ffffff` for backgrounds | ~5 components | **Replace with `var(--ep-color-neutral-0)` or `var(--ep-surface-0)`** depending on intent |

### Risk Items

| # | Risk | Mitigation |
|---|---|---|
| R1 | data-table.component.ts styles exceed 4 KB budget after extraction | Move PrimeNG overrides to global first; if still over, exempt that component or split |
| R2 | `viewEncapsulation: 'None'` means class names leak globally — `_primeng-overrides.scss` move could increase specificity unexpectedly | Use exact same selector text as existing `::ng-deep` blocks (just drop `:host ::ng-deep` prefix) — the cascading should remain identical because PrimeNG renders into Document scope anyway |
| R3 | `data-table.component.ts` has the most `::ng-deep` (16) — most regression-prone migration unit | Migrate this component LAST in the component batch, with screenshot test coverage |
| R4 | `[style.--*]` CSS variable bindings (e.g. `[style.--nav-height.px]`, `[style.--section-count]`) — must verify these still work in component SCSS | Confirmed: they are template bindings on host elements, not stylesheet rules. Migration doesn't touch them. |
| R5 | `_typography.scss` rename of `fonts.css` may confuse — README references `typography.css` (planned) | Rename and update `src/styles/README.md` to reflect new names |
| R6 | Tailwind `content` scan currently `*.{html,ts,scss}` — verify in `tailwind.config.ts` | Need to read this file in Phase 1 to confirm |
| R7 | Sass install (`npm install --save-dev sass`) — must use exact pinned version policy | Check `package-lock.json` strategy; default `sass` install uses `^x.x.x` — fine |
| R8 | Print media rules in `styles.css` (`@media print`) reference Angular component selectors (`app-status-banner-host`, `p-toast`, `p-confirmdialog`) — must move with print rules | Goes into `_reset.scss` |
| R9 | `[AutoValidateAntiforgeryToken]` and other server-side concerns — irrelevant to CSS migration | Confirmed: BFF code untouched |
| R10 | `dependency-cruiser` rules may flag new `_primeng-overrides.scss` global file imports | Verify dep-cruiser only checks TS/JS, not SCSS — this is normal |

---

## What the audit confirms is **already good**

These are already in line with the prompt's "target state":

- ✅ Design tokens centralized in one file with comprehensive coverage
- ✅ Tailwind v4 entry point uses `@import 'tailwindcss'` (not deprecated v3 syntax)
- ✅ PrimeNG `cssLayer` order configured correctly (`theme, base, primeng, utilities`)
- ✅ Dark mode mechanism: single `<html>.dark` class, ThemeService is single source of truth
- ✅ Token swap pattern for dark mode (no scattered `.dark .x` rules in components)
- ✅ `prefers-reduced-motion` is **global** in `animations.css`
- ✅ PrimeUix themes engine v2 (not deprecated `@primeng/themes`)
- ✅ `definePreset()` semantic tokens reference `--ep-*` (no PrimeNG/app-token duplication risk)
- ✅ `--ep-` namespace for design tokens (no library collision)
- ✅ Component styling already token-driven (`var(--ep-color-*)` ubiquitous)
- ✅ No `@apply` in component styles (zero regressions risk in Phase 2)
- ✅ No flat `.dark` selectors in components
- ✅ `anyComponentStyle` budget already set (4 KB warn / 8 KB error)
- ✅ Path aliases in tsconfig (`@core`, `@shared`, `@features`, etc.)
- ✅ Standalone components, OnPush, zoneless — all ready for Angular 21

---

## Proposed Phase 1 (infrastructure setup) — preview, not yet executed

If you approve this audit, Phase 1 will do:

1. `npm install --save-dev sass` (~10 MB, no transitive Angular dependencies)
2. `angular.json` patches:
   - `inlineStyleLanguage: "css"` → `"scss"`
   - Add `stylePreprocessorOptions.includePaths: ["src/styles"]`
   - `styles[]` `"src/styles.css"` → `"src/styles/styles.scss"`
   - `schematics.@schematics/angular:component.style: "css"` → `"scss"`
3. `tsconfig.json`: **untouched** (per chat decision)
4. **Verify** `tailwind.config` includes `.scss` in content scan (read file first; patch only if missing)
5. Build to confirm: `ng build --configuration=development` succeeds with old `styles.css` still in use *before any rename* — proves config changes alone don't break the build

**No SCSS partials created yet, no component files touched. Phase 1 is reversible by reverting one commit.**

Then Phase 2 creates the partials (rename + content move + new `_mixins.scss` + new `_primeng-overrides.scss` + new `_reset.scss`). Phase 3 migrates components in batches. Phase 4 verifies + adds Playwright screenshots.

---

## Proceed?

Confirm **"proceed to Phase 1"** and I'll:
- Install `sass`
- Patch `angular.json` (5 specific changes listed above)
- Verify `tailwind.config` content scan
- Run `ng build --configuration=development` to confirm green build with config changes alone (no SCSS files touched yet)
- Report back before starting Phase 2

If you want to adjust the audit findings — add components to/from scope, revisit a decision, or call out something I missed — say so and I'll re-audit before moving on.
