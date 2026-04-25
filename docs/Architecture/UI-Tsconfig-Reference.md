# UI TypeScript Configuration — Deep Reference

**Scope:** the three tsconfig files that govern TypeScript compilation in
`src/UI/Enterprise.Platform.Web.UI/ClientApp/`. Why three files exist,
what each owns, the IDE-vs-CLI discrepancy that produces phantom errors,
the project-references decision (and how to revive it if a future tool
needs it).

**Audience:**
- **New engineers** confused by the multi-file split.
- **Anyone debugging** "VS Code shows a red badge but `ng build` is green".
- **Tooling maintainers** considering changes to the strictness flags or
  paths.

**Companion docs:**
- [`UI-Architecture.md`](./UI-Architecture.md) — overall SPA architecture
- [`UI-Config-Files-Reference.md`](./UI-Config-Files-Reference.md) — every config file in ClientApp/
- [`API-Program-cs-Reference.md`](./API-Program-cs-Reference.md) — companion deep-dive on API startup

---

## 1 · TL;DR

```
ClientApp/
├── tsconfig.json           ← shared base: strict flags, path aliases, Angular options
│
├── tsconfig.app.json       ← APP build context
│   • inherits tsconfig.json
│   • include: src/**/*.ts
│   • exclude: src/**/*.spec.ts
│   • types: []   (no implicit @types/* injection)
│   • outDir: ./out-tsc/app
│   • Used by: `ng build`, `ng serve`
│
└── tsconfig.spec.json      ← TEST build context
    • inherits tsconfig.json
    • include: src/**/*.spec.ts + *.d.ts
    • types: ['vitest/globals', 'node']
    • outDir: ./out-tsc/spec
    • Used by: `vitest run`, `npm run test:unit`
```

The three-file split is **how the toolchain prevents test globals
(`describe`, `it`, `expect`) and Node-only types from leaking into the
browser bundle**. Without it, `import * as fs from 'node:fs'` would
compile cleanly in a component file and only blow up at runtime.

The root config has **no `references` block** because Angular CLI doesn't
use TypeScript's project-references mode. Adding one re-introduces TS6306
LSP errors with no compensating runtime benefit.

---

## 2 · Why three configs (not one)

### 2.1 The runtime-vs-build problem

`tsc` doesn't know about "browser code" vs "Node code" vs "test code"
inherently — it picks up types from `node_modules/@types/*` based on what
each tsconfig declares. With one shared tsconfig:

| Risk | Explanation |
|---|---|
| `@types/node` leaks into app | `process.env.X`, `require(...)`, `Buffer.from(...)` autocomplete in component files |
| `@types/vitest` leaks into app | `it(...)`, `describe(...)`, `expect(...)` are typed in production code |
| Spec files compile against app config | Specs that need `vi.mock()` / `vi.spyOn()` lose typing; you'd `// @ts-ignore` constantly |
| Output paths collide | App build and test build both write to `out-tsc/` — race condition |

The three-config split solves each of these by giving each compilation
**a separate `types[]` whitelist + separate `include`/`exclude`**.

### 2.2 The split in detail

```
tsconfig.json (root, shared)
├─ Defines: target, lib, module, strict flags, path aliases, Angular compiler opts
├─ Does NOT compile anything (`files: []`)
└─ Two children inherit it via `extends`

  ├─ tsconfig.app.json
  │  ├─ types: []                      ← block all @types/* implicit pickup
  │  ├─ include: src/**/*.ts
  │  ├─ exclude: src/**/*.spec.ts
  │  └─ outDir: ./out-tsc/app
  │
  └─ tsconfig.spec.json
     ├─ types: ['vitest/globals', 'node']   ← only these are visible
     ├─ include: src/**/*.spec.ts, src/**/*.d.ts
     └─ outDir: ./out-tsc/spec
```

The only difference between the two children is the **types whitelist**
and the **include/exclude pair**. Strict flags, path aliases, and Angular
options come from the shared root.

---

## 3 · `tsconfig.json` — the shared base

```jsonc
{
  "compileOnSave": false,
  "compilerOptions": {
    /* Base — environment + module shape */
    "baseUrl": "./",
    "target": "ES2022",
    "module": "preserve",
    "lib": ["ES2022", "dom"],
    "importHelpers": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,

    /* Strictness — every flag deliberate (see §3.2) */
    "strict": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,

    /* Path aliases — tier model */
    "paths": {
      "@core/*":     ["src/app/core/*"],
      "@shared/*":   ["src/app/shared/*"],
      "@features/*": ["src/app/features/*"],
      "@layouts/*":  ["src/app/layouts/*"],
      "@config/*":   ["src/app/config/*"],
      "@models/*":   ["src/app/core/models/*"],
      "@env/*":      ["src/environments/*"]
    }
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictTemplates": true,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "error",
        "missingControlFlowDirective": "error",
        "textAttributeNotBinding": "error",
        "nullishCoalescingNotNullable": "warning"
      }
    }
  }
  // NO `references` block — see §6
}
```

### 3.1 Base options explained

| Option | Why |
|---|---|
| `target: "ES2022"` | Modern browsers ship ES2022; downlevelling adds bundle bloat for nothing |
| `module: "preserve"` | esbuild handles module resolution; "preserve" tells `tsc` to leave imports untouched |
| `lib: ["ES2022", "dom"]` | DOM for browser; ES2022 to match `target`. No `WebWorker` because we don't have one |
| `importHelpers: true` | Routes generated helpers (`__decorate`, `__awaiter`) through `tslib` once instead of inlining per file — smaller bundle |
| `skipLibCheck: true` | Don't type-check `.d.ts` files in `node_modules`. Saves seconds per build; library type-correctness is the library's job |
| `isolatedModules: true` | Forces every file to be valid in single-file mode (esbuild constraint) |
| `experimentalDecorators: true` | Required for Angular's legacy decorators (`@Component`, `@Injectable`, etc.). New stage-3 decorators don't need this; we'll drop it when Angular drops the legacy decorator pass |

### 3.2 Strictness flags — the contract

Every flag here exists to catch a class of runtime bug at compile time.
Removing one weakens the contract.

| Flag | Catches |
|---|---|
| `strict: true` | Umbrella for `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, etc. |
| `noImplicitOverride` | `override` keyword required when overriding a base-class method — prevents silent rename drift |
| `noImplicitReturns` | Every code path in a typed function must `return` — catches forgotten branches |
| `noFallthroughCasesInSwitch` | `case 'x':` without `break` errors — classic C-family gotcha |
| `noPropertyAccessFromIndexSignature` | `record.foo` errors when `record` has an index signature; forces `record['foo']` so the optional access is explicit |
| `noUncheckedIndexedAccess` | `arr[0]` returns `T \| undefined`. **Caught a real bug in `user-menu.component.ts` last week** (`parts[parts.length - 1][0]` on single-word names) |
| `forceConsistentCasingInFileNames` | `import { Foo } from './foo'` vs `'./Foo'` are the same on Mac, different on Linux — fail at compile time, not at deploy |

### 3.3 Path aliases — the tier model

```
@core/*     → core (auth, guards, http, interceptors, observability, services, stores)
@shared/*   → shared (UI primitives, directives, design system)
@features/* → features (vertical slices per aggregate)
@layouts/*  → layouts (AppShell, AuthLayout, ErrorLayout)
@config/*   → application provider graph, MSAL/PrimeNG/runtime config
@models/*   → narrow alias to core/models
@env/*      → environment.ts files
```

ESLint's `import/no-restricted-paths` rule enforces tier boundaries on
top of these aliases (see `eslint.config.js`). The aliases just make the
imports readable; the architecture is enforced separately.

### 3.4 `angularCompilerOptions`

| Option | Why |
|---|---|
| `enableI18nLegacyMessageIdFormat: false` | Use modern hash-based i18n IDs (legacy format is deprecated) |
| `strictTemplates: true` | HTML templates are type-checked against the component class. **This catches the bulk of real bugs** — typo'd input names, wrong binding shape, missing required inputs |
| `strictInjectionParameters: true` | `inject(MyService)` errors if `MyService` isn't provided in scope |
| `strictInputAccessModifiers: true` | `private` inputs error (because templates can't access them) |
| `extendedDiagnostics` | Configurable diagnostic severities — keeps the noise level on warnings, escalates real bugs to errors |

---

## 4 · `tsconfig.app.json` — the app build

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

### 4.1 Why each line exists

| Line | Purpose | What breaks without it |
|---|---|---|
| `"extends": "./tsconfig.json"` | Inherit strict flags, paths, Angular options | App build loses every guarantee in §3.2 |
| `"outDir": "./out-tsc/app"` | Distinct output directory for tsc emissions | Output races with spec build at `./out-tsc/`; incremental cache thrashes |
| `"types": []` | Block implicit `@types/*` pickup | `@types/node` (transitively pulled by Vitest deps) leaks into app — `import 'node:fs'` would type-check in components |
| `"include": ["src/**/*.ts"]` | Compile every TS file under `src/` | Files outside the include don't get strict-checked |
| `"exclude": ["src/**/*.spec.ts"]` | Don't compile specs in the app build | Specs would need their own tsc invocation; `it()` / `describe()` symbols become unresolvable |

### 4.2 Used by

| Tool | How it consumes this file |
|---|---|
| `ng build` | Angular's `@angular/build:application` builder reads `tsconfig.app.json` from `angular.json → architect.build.options.tsConfig` |
| `ng serve` | Same — `architect.serve` reuses the build target's tsconfig |
| `ng build --configuration=production` | Same — bundle budgets + file-replacements come from `angular.json`, but tsconfig is identical |
| `npx tsc -p tsconfig.app.json --noEmit` | Manual type-check — useful for CI before bundling |

### 4.3 NOT used by

| Tool | Uses instead |
|---|---|
| Vitest unit tests | `tsconfig.spec.json` (configured in `vitest.config.ts`) |
| Playwright E2E | Its own `tsconfig` under `e2e/` (not part of the workspace tsconfigs) |
| Storybook | Its own `tsconfig` under `.storybook/` |
| ESLint | Auto-discovers via `parserOptions.projectService: true` — uses both as appropriate |

---

## 5 · `tsconfig.spec.json` — the test build

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

### 5.1 Why each line exists

| Line | Purpose |
|---|---|
| `"types": ["vitest/globals", "node"]` | Make `describe`, `it`, `expect`, `vi`, `process`, `Buffer`, etc. typed globally in specs without per-file imports |
| `"include": ["src/**/*.spec.ts", "src/**/*.d.ts"]` | Spec files only + any ambient declarations |

`*.d.ts` is included so spec-only ambient types (e.g. a custom `vi.mock`
setup file) are picked up.

### 5.2 Note on the spec build

`tsc -p tsconfig.spec.json` currently surfaces ~70 errors. Most are
known-tracked items in `feedback_ui_phase4_gotchas.md`:
- `signalStore` types don't thread through generic features (auth.store
  spec; tracked).
- `runtime-config.spec.ts` has tuple-type narrowing issues from the Zod
  schema (tracked).

These don't block `ng build` and don't appear in the Vitest run because
Vitest uses its own type-stripping path (esbuild-jest, not `tsc`). They
ARE on the Phase-4 cleanup list. **They are unrelated to the
`tsconfig.app.json` "2" badge.**

---

## 6 · The `references` decision (and the IDE-vs-CLI gap)

### 6.1 What TypeScript's project references mode is

TypeScript's `references` lets a parent tsconfig declare child projects
that should be built as a unit. When you run `tsc --build .`, every
referenced child compiles in dependency order, with `.tsbuildinfo` files
caching results between invocations.

**For project references to work, every referenced child MUST set
`composite: true`** (which in turn requires `declaration: true`).

### 6.2 What we had before

```jsonc
// (old) tsconfig.json
{
  ...
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

Neither child set `composite: true` (Angular's default schematic
generates the references but not the matching child flag). So:

| Surface | What happened |
|---|---|
| `tsc --build .` | Errored — TS6306 ("Referenced project must have setting 'composite: true'") |
| `tsc -p tsconfig.app.json` | **No error** — single-project mode ignores `references` |
| `ng build` | **No error** — Angular's builder runs each tsconfig directly |
| VS Code TypeScript LSP | **2 red badges on tsconfig.app.json** — LSP runs in build-aware mode and surfaces TS6306 + a related diagnostic |

### 6.3 Why we removed `references` (vs adding `composite: true`)

Two options to make the LSP happy. We picked Option A — remove the
unused `references` block.

| | Option A · Remove `references` ✅ | Option B · Add `composite: true` to children |
|---|---|---|
| LSP error count | 0 | 0 |
| Effect on `ng build` | None | None |
| Effect on Vitest | None | None |
| `tsc --build .` convenience | Lost (would need `tsc --build tsconfig.app.json tsconfig.spec.json`) | Kept |
| `out-tsc/` size | No change | **Grows** — TypeScript emits `.d.ts` for every source file (plus `.tsbuildinfo`) |
| Coupling | Less — tsconfigs are independent | More — children carry a `composite: true` constraint that's hard to unwind |
| Idiomatic for Angular CLI | **Yes** — Angular doesn't use project references | No — fights the Angular toolchain's grain |
| If a future tool needs project references | Re-add per §6.4 | Already there |

The `tsc --build .` convenience matters for monorepos that *actually*
use project references for build orchestration. We don't — `ng build`,
`vitest run`, and `tsc -p tsconfig.app.json --noEmit` cover every real
need.

### 6.4 Recipe — revive project references later

If a future tool (e.g. a shared TypeScript library project consumed via
project references) needs them, here's the full setup:

1. **Children** (`tsconfig.app.json` + `tsconfig.spec.json`):
   ```json
   {
     "compilerOptions": {
       "composite": true,
       "declaration": true
       // ...existing options
     }
   }
   ```
2. **Parent** (`tsconfig.json`):
   ```json
   {
     // ...existing options
     "files": [],
     "references": [
       { "path": "./tsconfig.app.json" },
       { "path": "./tsconfig.spec.json" }
     ]
   }
   ```
3. **`.gitignore`** — add `*.tsbuildinfo` so the incremental cache files
   never land in commits.
4. **`out-tsc/`** — verify the directory is in `.gitignore` (it already
   is) AND in `.prettierignore` AND in `eslint.config.js` ignores. The
   declaration files there are noise for the rest of the toolchain.

---

## 7 · The IDE-vs-CLI gap — diagnostic table

If a tsconfig file shows a badge in your editor but `tsc` is silent,
this table identifies the cause.

| IDE diagnostic | Likely TS code | Why CLI doesn't see it | Fix |
|---|---|---|---|
| "Referenced project must have setting 'composite: true'" | TS6306 | `tsc -p <child>` runs single-project mode; doesn't read parent's references | Either add `composite: true` (§6.4) or remove the parent's `references` block (current choice) |
| "Project references may not enable declaration emit" | TS6310 | Same as above | Same |
| "File is not under 'rootDir'" | TS6059 | Single-file invocations skip rootDir checks | Set `rootDir` explicitly or restructure imports |
| "No inputs were found in config file" | TS18003 | Empty `include` after exclusion is fine for `tsc --noEmit`, but LSP flags it | Verify `include` patterns match real files |
| "Cannot find type definition file for 'X'" | TS2688 | Missing `@types/X` only matters if some file uses it | `npm i -D @types/X` or remove from `types[]` |

The general rule: **the LSP is stricter than the CLI** because it tries to
give "what would `tsc --build` say if you ran it across the whole
workspace" answers. The CLI is more lenient when invoked per-config.

---

## 8 · How to verify after any tsconfig change

```bash
# 1. App type-check
npx tsc -p tsconfig.app.json --noEmit
# Expected: 0 errors

# 2. App build
npm run build
# Expected: 0 errors, 0 warnings

# 3. Spec type-check (currently has known errors — see §5.2)
npx tsc -p tsconfig.spec.json --noEmit
# Expected: only the tracked spec issues; no NEW errors introduced

# 4. Vitest run (uses esbuild — its own type-stripping)
npm run test:unit
# Expected: pass

# 5. ESLint (uses parserOptions.projectService for tsconfig auto-discovery)
npm run lint
# Expected: 0 errors

# 6. VS Code reload — clear LSP cache
# Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"
# Verify badges on tsconfig.*.json are gone
```

---

## 9 · Common pitfalls

### 9.1 "I added `composite: true` and now ESLint hangs"

ESLint's `parserOptions.projectService` discovery recurses through
project references when `composite` is on. If your spec config also
references everything in `src/**`, ESLint can spend tens of seconds
walking the graph per file. Either:
- Narrow `include` patterns
- Switch ESLint back to `parserOptions.project: ['./tsconfig.json']` explicitly

### 9.2 "I removed `experimentalDecorators` and Angular DI broke"

Angular's legacy `@Injectable` / `@Component` decorators still depend on
the experimental decorator metadata reflection. Until Angular fully
migrates to stage-3 decorators (planned for v22+), the flag stays.

### 9.3 "ESLint can't find symbols I added to `tsconfig.app.json`"

ESLint uses `projectService` (TS LSP-driven discovery). Restart your
editor's TS server: VS Code → Command Palette → *"TypeScript: Restart TS
Server"*. Same for WebStorm.

### 9.4 "I added a path alias and `ng build` fails"

Path aliases live in `tsconfig.json` (the shared base). They're picked
up by both children. But other tools also need them:
- **Vitest** — duplicate the alias in `vitest.config.ts → resolve.alias`
  (it doesn't auto-read TS paths).
- **Storybook** — duplicate in `.storybook/main.ts → viteFinal`.
- **ESLint `import/resolver`** — handled automatically when
  `parserOptions.projectService` is on.

This is a known Angular quirk; the documented place to add aliases is
`tsconfig.json` plus any Vite-based runner config.

---

## 10 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-25 | Claude (Opus 4.7) | Initial deep reference. Removed unused `references` block from `tsconfig.json` to silence VS Code LSP TS6306 warnings without affecting `ng build` / Vitest. Documented the IDE-vs-CLI diagnostic gap, three-config split rationale, project-references revival recipe. |
