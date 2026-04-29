# UI Standards — Triage & Rejected Patterns

When external "best-practices" prompts arrive proposing sweeping migrations
(SCSS conversion, BaseApiService, Result-pattern, factory abstractions,
mass enum conversion, etc.), this document is the canonical response.

> The principle: **build patterns when needed, not speculatively.** Premature
> abstraction is dead code that rots faster than it pays back. Every "shared
> primitive" we ship has a real consumer or imminent use; otherwise it
> stays unbuilt.

---

## Adopted shared primitives (2026-04-26)

### `src/app/shared/utils/`

Five files, narrowly scoped, real consumers identified:

| File | Functions | Real consumer today |
|---|---|---|
| `type-guard.utils.ts` | `isDefined`, `isNullish`, `isString`, `isNumber`, `isBoolean`, `isFunction`, `isObject`, `isArray`, `isEmpty` | Used at API/route/3rd-party boundaries; small, dependency-free |
| `string.utils.ts` | `truncate`, `toInitials`, `slugify`, `maskString` | `UserMenuButtonComponent.initials` migrated; truncate ready for breadcrumb / table cells |
| `crypto.utils.ts` | `generateUuid`, `generateIdempotencyKey`, `generateCorrelationId` | `correlationInterceptor` and `usersApi.idempotencyHeader()` migrated; future POSTs reuse |
| `number.utils.ts` | `formatCurrency`, `abbreviateNumber`, `formatPercentage`, `clamp`, `roundTo` | First dashboard KPI tile — imminent |
| `date.utils.ts` | `isExpired`, `addMinutes`, `formatCountdown`, `toRelativeTime` | Maintenance banner countdown, session-expiring dialog — imminent |

Imported via `@utils` alias.

### `src/app/shared/constants/`

| File | Symbol | Purpose |
|---|---|---|
| `storage.constants.ts` | `STORAGE_KEYS` | Single source of truth for every browser-storage key the app owns. Prevents typo-drift; documents app's keyspace for GDPR audit. |

Imported via `@constants` alias. Migrations done: `StatusBannerService.DISMISS_STORAGE_KEY`, `DomainStore.STORAGE_KEY`, `ThemeService.THEME_KEY`, `PlatformFooterComponent.COOKIE_CONSENT_KEY` all reference `STORAGE_KEYS.*` now.

### Path aliases added

`tsconfig.json` + `vitest.config.ts`:
```jsonc
"@utils":       ["src/app/shared/utils"],
"@utils/*":     ["src/app/shared/utils/*"],
"@constants":   ["src/app/shared/constants"],
"@constants/*": ["src/app/shared/constants/*"]
```

---

## Deliberately rejected (with rationale)

When an external prompt proposes any of the items below, the answer is "no,
because…". Don't relitigate without new evidence.

### 1 — SCSS migration (every component → SCSS partials, mixins, `@forward`)

**~~Rejected~~ — Adopted 2026-04-29.** The original rationale held up to a point — Tailwind v4 covered most of what mixins would buy us — but two pressures forced the migration:

1. The lifted `_primeng-overrides.scss` partial wanted Sass nesting/`@use` for legibility (~33 lifted PrimeNG-targeting blocks).
2. Component bodies still contained ~14kB of inline CSS-in-template-literal that the `anyComponentStyle` budget couldn't see (CLI counts only `styleUrl[s]`). Visibility regression risk.

The migration was scoped narrow on purpose — see `Demo/scss-migration-audit.md` §Outcome:
- Globals renamed `tokens.css` → `_tokens.scss` (etc.) and composed via `@use`. **No `@forward` chains** — partials are flat.
- Components moved to sibling `*.component.scss` via `styleUrl`.
- Tailwind v4's `@import 'tailwindcss'` directive lives in a sibling `tailwind.css` (Sass 1.99 deprecates bare `@import`).
- Mixins added only for patterns appearing 3+ times: 14 total. Tailwind responsive utilities are still the default; the Sass `mobile/tablet/desktop/wide` mixins only exist because some component-internal media queries don't naturally map to a Tailwind class context.

### 2 — Inline-style purge (move every `styles: [\`...\`]` to `styleUrls`)

**~~Rejected~~ — Adopted 2026-04-29 alongside item 1.** The original concern (~30 components → ~60 files) was real, but the budget-visibility argument flipped the calculus: keeping styles inline meant the `anyComponentStyle` budget couldn't enforce a per-file ceiling. All 41 in-scope components now use `styleUrl: './<name>.component.scss'`. Budget bumped 4kB/8kB → 8kB/12kB to accommodate the now-visible bytes; see `feedback_anyComponentStyle_budget_inline_blind` memory.

### 3 — `BaseApiService` extension pattern (every service extends it)

**Rejected.** Inheritance is anti-Angular and tightly couples services to a base. Our functional interceptor chain (correlation, security, cache, dedup, loading, logging, retry, error) already handles every cross-cutting concern `BaseApiService` claims to. Adding inheritance:
- Makes services hard to test (must mock the base)
- Hard to compose (mixin hell when 2 base services are needed)
- No measurable win over the interceptor chain

**Re-evaluate when:** Never — interceptors are the Angular way.

### 4 — `Result<T, E>` pattern in all service methods

**Rejected.** `Observable<T>` + the error interceptor → notification toast already covers every error path we care about. Adopting `Result<T, E>`:
- Rewrites every service signature
- Rewrites every consumer to handle `Result.ok` / `Result.fail` branches
- Provides no additional information vs. RxJS `error` channel
- Friction tax on every new service for the rest of the codebase's life

**Re-evaluate when:** A specific feature genuinely benefits from explicit error-as-value semantics (rare in UI; common in compilers and parsers).

### 5 — `createCrudService<T>` / `createListStore<T>` factories

**Rejected.** NGRX Signals (`signalStore`, `withState`, `withMethods`, `rxMethod`) is already the generic CRUD primitive. Wrapping it in a factory:
- Adds an indirection layer with no upside
- We have ONE list store today (`UsersStore`) — premature factory
- When we have 3+ list stores, the duplication will reveal what the factory should actually look like (driven by real usage, not speculation)

**Re-evaluate when:** A 3rd list store lands and we measure the duplication cost.

### 6 — `BreakpointService` with `BreakpointObserver`

**Rejected.** CSS media queries are reactive automatically, zero JS, zero signal subscription overhead, zero SSR mismatch risk. `BreakpointObserver` is heavier and only meaningful when JS code needs to know the viewport class (rare — usually CSS handles it). Where we DO need responsive class toggling, we use Tailwind's `sm:` / `md:` / `lg:` utilities or media-query CSS.

**Re-evaluate when:** A specific component genuinely needs JS to know the viewport class (e.g. a chart that picks a different render strategy at mobile widths).

### 7 — `HasPermissionDirective` (`*appHasPermission="['users.create']"`)

**Rejected.** Already done at the component layer:
- `NavMenuComponent.permissionAllowed()` filters menu items at render time
- `AuthStore.hasAnyPermission()` is the single check used everywhere
- Page-level `canActivate` guards block route entry

A structural directive duplicates the gate; it doesn't replace anything.

**Re-evaluate when:** Dozens of feature templates need granular per-element gating — at that point, a directive becomes a real DRY win.

### 8 — Mass enum conversion (literal unions → TypeScript `enum`)

**Rejected.** Modern TypeScript (per the official handbook + Effective TypeScript book) recommends literal unions over enums:
- Equally type-safe at compile time
- `enum` is NOT tree-shakable (runtime object stays in bundle)
- Literal unions vanish at compile time
- JSON interop is a wash with literal unions, friction with enums (`data.x as MyEnum.Value` casts everywhere)
- `'success'` IS the documentation; `MyEnum.Success` is a naming layer for nothing

When iteration is needed, the modern pattern is:
```ts
export const SEVERITIES = ['success', 'warning', 'danger', 'info'] as const;
export type Severity = typeof SEVERITIES[number];
```
Both the literal-union type AND a runtime array, no enum overhead.

**Re-evaluate when:** Never. This is settled TypeScript-community guidance.

### 9 — Mass route-constants file (`ROUTES.DASHBOARD = '/dashboard'`)

**Rejected for now.** We have 5 actual routes (`/dashboard`, `/users/*`, `/auth/login`, `/error/*`, `/demo/sub-nav`). Each is typed in a route config. Adding a `ROUTES` constants object today:
- Most listed paths in the prompt don't exist (`/signals`, `/portfolio`, `/journal`, `/analytics`)
- Five strings doesn't justify a constants file + import everywhere
- Angular Router's typed route helpers are coming (RFC) and may obsolete this anyway

**Re-evaluate when:** We have 15+ feature routes AND see a typo bug in `routerLink="/dashbord"`-style strings.

### 10 — Mass HTTP-headers / HTTP-status / regex constants files

**Rejected for now.** We have a few headers (`X-Correlation-ID`, `Idempotency-Key`) used in 1-2 places each. We have ZERO regex validation features (no `phone-format`, no `tax-id`, no validation forms). Building these constants files now produces empty containers.

**Re-evaluate when:** A validation-heavy feature lands (admin user-management, billing settings, etc).

### 11 — `permission.constants.ts` (typed policy keys)

**Rejected for now.** We have one policy in active use (the Users feature's `users.read` etc. via `permissionGuard`). We don't yet have 3+ feature permissions to extract. Adding the constants file before the permissions exist creates dead values.

**Re-evaluate when:** The 3rd policy key appears in route metadata or store factories.

### 12 — `eslint no-magic-numbers` rule

**Rejected.** Industry teams typically turn this off within a week — it false-positives on legitimate values (`flex: 1 1 0`, `0.5rem`, `200ms`, `gap: 8px`). The signal-to-noise ratio is poor.

**Re-evaluate when:** Never.

---

## Decision tree for the next "you should adopt this prompt"

1. **Does the prompt's pattern have a real consumer today?** No → reject; revisit when consumer arrives.
2. **Does the pattern conflict with a documented locked-in decision** (Styling Strategy, db-first pivot, interceptor chain)? Yes → reject; cite the doc.
3. **Is the pattern a primitive (utility, constant, type) or an architecture (base class, factory, structural directive)?** Primitive → easier to add safely. Architecture → high bar; demand a specific concrete pain point this resolves.
4. **What's the migration cost vs. the measured win?** If the win is "code looks more abstract" without measurable performance/correctness/clarity gain → reject.

---

## How to invoke this triage

When a future prompt arrives:
1. Skim the triage table above for direct overlap
2. For new items: walk the decision tree
3. Document any new rejections back into this file with rationale
4. Document any new adoptions in the "Adopted" section above
