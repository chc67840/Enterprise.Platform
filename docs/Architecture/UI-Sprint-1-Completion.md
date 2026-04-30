# UI Sprint 1 — Completion

**Date:** 2026-04-30 · **Branch:** `feature/db-first-pivot` · **Status:** GREEN

Foundation work for the UI primitives roadmap. Eight discrete tasks land
as a coherent foundation set: tokens + Tailwind safelist + PrimeNG papercut
fixes + scrollbar utilities + ConfirmDialogService + the schema-form event
channel + the upgraded drawer-with-size-presets + the chart widget.

## Scope

| ID | Title | Effort | Status |
|----|-------|--------|--------|
| **P0.1** | Token scales — z-index/duration/easing | S | ✅ Completed |
| **P0.2** | Cross-browser scrollbar utilities | XS | ✅ Completed |
| **P0.3** | PrimeNG papercut overrides — autofill + force-block | S | ✅ Completed |
| **P0.4** | Tailwind dynamic-class safelist | S | ✅ Completed |
| **P0.5** | ConfirmDialogService Promise wrapper | XS | ✅ Completed |
| **P1.1** | SchemaFormEvent single-channel union | S | ✅ Completed |
| **P1.2** | Drawer panel with size presets + named-slot footer | M | ✅ Completed |
| **P1.3** | ChartWidgetComponent with theme-aware rebuild | M | ✅ Completed |
| **B.1** | Semantic intent tokens migration | L | ✅ Completed |

## Build / test deltas

|                | Before Sprint 1 | After Sprint 1 | Δ |
|----------------|----------------:|---------------:|----:|
| `vitest run` total | 143 | **203** | +60 |
| `vitest run` skipped | 2 | 2 | 0 |
| `ng build` | green | **green** | — |
| Lint errors in Sprint-1 files | 0 | **0** | 0 |
| Pre-existing lint errors (not Sprint 1) | 13 | 13 | 0 |

## Files added

```
src/styles/_scrollbars.scss
src/app/core/services/confirm-dialog.service.ts
src/app/core/services/confirm-dialog.service.spec.ts        (7 tests)
src/app/shared/components/dph/schema-form-events.spec.ts    (5 tests)
src/app/shared/components/dph/drawer.component.spec.ts      (27 tests)
src/app/shared/components/dph/chart-widget.types.ts
src/app/shared/components/dph/chart-widget.builder.ts
src/app/shared/components/dph/chart-widget.builder.spec.ts  (21 tests)
src/app/shared/components/dph/chart-widget.component.ts
src/app/shared/components/dph/chart-widget.component.scss
Docs/Architecture/UI-Semantic-Tokens-RFC.md
Docs/Architecture/UI-Sprint-1-Completion.md
```

## Files modified

```
src/styles/_tokens.scss             (B.1 + P0.1 — semantic intents, density, motion-scale, prefers-reduced-motion)
src/styles/_mixins.scss             (motion(), focus-ring-intent() mixins)
src/styles/_primeng-overrides.scss  (P0.3 — autofill suppression, force-block hosts)
src/styles/styles.scss              (wire scrollbars partial)
src/styles/tailwind.css             (P0.4 safelist + B.1 intent utilities)
src/app/core/services/index.ts      (export ConfirmDialogService)
src/app/shared/components/dph/index.ts                  (export new symbols)
src/app/shared/components/dph/dph.types.ts              (DrawerSize + drawer extensions)
src/app/shared/components/dph/drawer.component.ts       (P1.2 — size presets, footer slot)
src/app/shared/components/dph/drawer.component.scss     (body / footer layout)
src/app/shared/components/dph/schema-form.component.ts  (P1.1 — event channel)
src/app/shared/components/dph/schema-form.types.ts      (P1.1 — event union + guards)
src/app/features/users/views/users-list.component.ts    (refactor to ConfirmDialogService.ask())
```

## Architectural decisions worth recording

### 1. Pure-function builders for testability

`drawer.component.ts` and `chart-widget.component.ts` both extract their core
logic to PURE FUNCTIONS exported from companion files
(`resolveDrawerDimension`, `buildChartData`, `buildChartOptions`,
`paletteColor`). These get tested directly without `TestBed.createComponent`,
which under Angular 21 + jsdom requires expensive `resolveComponentResources()`
plumbing for components with `styleUrl`.

The architecture rule going forward: **business logic that can be expressed
as a pure function should be**. Components become thin shells that wire
inputs → pure-function call → template.

### 2. Tailwind `@source inline()` for dynamic classes

Tailwind v4's content scanner can't see classes built via template literals
(`col-span-${span}`). The `@source inline("{,sm:,md:,lg:,xl:,2xl:}col-span-{1...12}")`
directive in `tailwind.css` keeps the full grid matrix in the bundle. **Any
new dynamic-class construction MUST extend the manifest**, with an inline
comment naming the introducing component.

Bundle cost: a few KB minified — trivial.

### 3. PrimeNG autofill 5000s-transition hack

The `transition: background-color 5000s ease-in-out 0s` is a deliberate hack.
It defers Chrome's autofill repaint until the `box-shadow` inset wins
visually. **Do not shorten this duration** — it's load-bearing.

### 4. SchemaForm event channel: deprecation window

The new `(onEvent)` discriminated-union output sits ALONGSIDE the legacy
`(submit) (cancel) (valueChange)` outputs. Both fire in parallel during the
deprecation window. Hosts migrate at their own pace; once all consumers
move, the legacy outputs delete in a single PR.

### 5. ChartWidget theme-revision signal

Chart.js bakes colors at construction; CSS variable changes don't trigger
chart re-renders. The `themeRevision = signal(0)` is bumped from an
`effect()` watching `ThemeService.isDark()`, then read by `chartData()`
and `chartOptions()` computeds. The signal write is wrapped in
`untracked()` to avoid the signal-self-write loop trap (already memoized
in `feedback_signal_effect_self_write_loop.md`).

This is the **correct** answer to "my chart's text stays black after
toggling dark mode". Chart.js maintainers acknowledge but won't add CSS
variable observation; the workaround belongs in user code.

### 6. ConfirmDialog: severity-driven button class

`severity: 'danger'` → `p-button-danger` accept button + `defaultFocus:
'reject'` (the safer side). `severity: 'success'` → `p-button-success`.
`severity: 'warn'` → `p-button-warn`. The mapping is automatic so callers
don't repeat the `acceptButtonStyleClass` boilerplate.

### 7. Density via `[data-density]` attribute, not class

`[data-density="compact"]` rebinds `--ep-control-height` for the subtree.
Attribute-based instead of class-based to avoid collisions with Tailwind's
`dark:` variant family.

## Migration impact

The following migrations land WITH this sprint, not as follow-ups:

- `users-list.component.ts:confirmActivate` now uses `await
  this.confirm.ask(...)` (Promise API). Behavior identical.
- The schema-form's existing outputs (`submit`, `cancel`, `valueChange`)
  are marked `@deprecated`. They still fire; hosts migrate in their
  own time.

Pending migrations (NOT done in Sprint 1):

- `_animations.scss` keyframes don't yet consume `--ep-motion-scale`. The
  global `prefers-reduced-motion` shortcut from before is still in place
  (an existing block in `_animations.scss`), so reduced-motion users see
  correct behavior; the per-keyframe scale-based variant is a follow-up
  cleanup.
- Component-by-component scale-token → intent-token migration is **not**
  in this sprint. The intents are NEW additions; no existing scale tokens
  were removed. Future PRs migrate per-component.

## Sprint 2 — what's next

| ID | Title | Effort | Owner |
|----|-------|--------|-------|
| **P1.4** | FieldConfig 22-type discriminated union | XL | Senior dev (full sprint) |
| **B.2** | `prefers-reduced-motion` integration in keyframes | S | Parallel |
| **B.5** | Skip-link + AnnouncerService | S | Parallel |

P1.4 is the dominant story — a single owner walks the FieldConfig migration
end-to-end (type system → 22 field components → dispatcher → form-builder
service → server-error mapping → `visibleWhen`/`disabledWhen` → `users`
feature migration → tests).

B.2 and B.5 are independent and can run in parallel by a second dev.

## References

- `Docs/Architecture/UI-Semantic-Tokens-RFC.md` — B.1 RFC
- `Docs/Architecture/UI-Color-Palette-Strategy.md` — base palette
- `Docs/Architecture/UI-Styling-Strategy.md` — Tailwind v4 + PrimeNG cssLayer
- `Docs/Architecture/UI-Layout-Type-System.md` — chrome typing
- Memory: `feedback_signal_effect_self_write_loop.md` — the untracked() trap
- Memory: `feedback_model_explicit_output_name_collision.md` — model + output name collision
