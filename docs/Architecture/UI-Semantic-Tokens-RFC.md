# UI Semantic Tokens — RFC

**Status:** Approved · **Phase:** B.1 (Sprint 1) · **Date:** 2026-04-30

## Motivation

The platform's design tokens are **scales** — concrete values like
`--ep-color-neutral-700` (a specific gray), `--ep-space-4` (16 px),
`--ep-radius-md` (8 px). Components reference these scales directly:

```scss
.ep-card {
  border: 1px solid var(--ep-color-neutral-200);
  color: var(--ep-color-neutral-900);
  padding: var(--ep-space-4);
}
```

This works, but creates two problems:

1. **Theme axes don't compose.** Adding a "high-contrast" mode, a "compact"
   density, or a tenant-specific override requires touching every component
   that references a concrete shade. There's no single decision point.

2. **Code reads as values, not intent.** A reviewer can see `border-color:
   var(--ep-color-neutral-200)` but doesn't know whether that's a "subtle
   separator", a "default border", or an "active indicator". Refactoring
   the underlying scale (e.g. promoting `neutral-700` to a different hue)
   means re-evaluating every call site to confirm the intent still holds.

**Semantic intent tokens** decouple components from the underlying scale.
A component asks for "a subtle border" via `var(--ep-border-subtle)`, and
the token system decides which scale step that resolves to — different in
light vs dark, in compact vs comfortable, in tenant A vs tenant B.

## Decision

Add a semantic-intent layer on top of the existing scale tokens. Components
SHOULD prefer intent tokens over scale tokens.

### The migration rule

> **Brand assets** (logos, gradients, theme accents) consume scale tokens.
> **Components** (everything else) consume intent tokens.

A logo gradient that's literally "the brand colours" stays on
`var(--ep-color-primary-500)`. A card border that's "the default border"
moves to `var(--ep-border-default)`.

### Token families

| Family   | Token names | Purpose |
|----------|-------------|---------|
| **Text** | `--ep-text-primary` `--ep-text-secondary` `--ep-text-muted` `--ep-text-disabled` `--ep-text-inverse` `--ep-text-link` `--ep-text-link-hover` `--ep-text-link-visited` | Contrast tiers, NOT colour choices. Inverse is for text on dark/colored surfaces. |
| **Background** | `--ep-bg-canvas` `--ep-bg-elevated` `--ep-bg-sunken` `--ep-bg-overlay` | `canvas` is the page; `elevated` for cards/modals/panels; `sunken` for inset wells (code blocks, input groups); `overlay` is the modal scrim. |
| **Border** | `--ep-border-subtle` `--ep-border-default` `--ep-border` `--ep-border-strong` `--ep-border-focus` | `subtle` for separators that shouldn't compete; `default` for inputs/cards; `strong` for active states; `focus` is the brand focus indicator. |
| **Spacing — vertical rhythm** | `--ep-stack-{xs,sm,md,lg,xl,2xl}` | Vertical spacing between stacked elements. |
| **Spacing — horizontal rhythm** | `--ep-inline-{xs,sm,md,lg,xl}` | Inline / cluster gaps. |
| **Spacing — uniform inset** | `--ep-inset-{xs,sm,md,lg,xl}` | Padding all sides. |
| **Density** | `--ep-control-height` (resolves via `[data-density]` attribute) | Control height switches per density mode. |
| **Focus ring** | `--ep-focus-ring-{width,offset,color,color-danger,color-warning,color-success}` | Configurable focus ring; per-form `color` rebind for destructive/warning forms. |
| **Motion** | `--ep-motion-scale` | `1` by default, `0` under `prefers-reduced-motion`. |

### Resolution

Tokens resolve through CSS variable inheritance:

```scss
:root {
  --ep-bg-elevated: var(--ep-color-neutral-0);  /* light theme */
}
:root.dark {
  --ep-bg-elevated: var(--ep-surface-0);        /* dark theme */
}
[data-density='compact'] {
  --ep-control-height: var(--ep-control-height-compact);
}
```

Components consume the alias and inherit the right concrete value
automatically:

```scss
.ep-card {
  background: var(--ep-bg-elevated);
  border: 1px solid var(--ep-border-default);
  padding: var(--ep-inset-md);
}
```

Same component, different theme, different density — no class toggling
on the component itself, no `@media`, no JS theme-switch logic.

### Density modes

`[data-density="compact" | "comfortable" | "touch"]` on any ancestor
rebinds `--ep-control-height` for that subtree. Components consuming
`var(--ep-control-height)` resize automatically; no `[size]` input
needed.

```html
<section data-density="compact">
  <dph-input ... />     <!-- 32 px tall -->
  <dph-button ... />    <!-- 32 px tall -->
</section>
```

### Motion preferences (B.2 wire-up)

`@media (prefers-reduced-motion: reduce)` flips `--ep-motion-scale` to
`0`. Components that use the `motion()` mixin from `_mixins.scss` snap
to instant transitions automatically:

```scss
.ep-card {
  @include m.motion(transform, fast, standard);
}
```

This expands to `transition: transform calc(var(--ep-duration-fast) *
var(--ep-motion-scale)) var(--ep-ease-standard)`. With reduced motion
on, the calc evaluates to `0ms` and the transition is instant.

**Essential motion** (loading spinners, async progress) MUST NOT consume
`--ep-motion-scale` — frozen feedback is worse UX than reduced. Declare
those with literal durations.

### Tailwind utility bridge

Each intent token gets a Tailwind utility via the `@theme inline` block
in `tailwind.css`:

```html
<div class="bg-elevated text-text-primary border border-default">
```

The duplication of `text-text-*` is intentional — Tailwind names utilities
by `<scale-name>-<step>`, so a scale literally named `text` produces
`text-text-primary`. Renaming the scale (`fg-*`, `ink-*`) was considered
and rejected; preserving the SCSS source-of-truth name is more important
than utility-class brevity.

## Migration plan

Do not bulk-find-replace. Each occurrence has intent that may not match
the obvious mapping. The procedure:

1. **Inventory** the scale tokens used in each component.
2. **For each occurrence, decide intent.** A `surface-200` border in
   light mode might be `border-subtle` (separators) OR `border-default`
   (input chrome) OR `border-strong` (active states). The intent name
   tells future readers which it is.
3. **Replace** with the intent alias.
4. **Verify dark mode** by toggling `<html class="dark">` and walking
   the page.

## Out of scope (for now)

- **High-contrast mode.** The scaffold supports it (semantic intents
  bound to brand-tinted scales); the CSS for the high-contrast bindings
  doesn't ship until accessibility audit Phase A2.
- **Print mode.** Existing `_reset.scss` `@media print` block handles
  this at low fidelity.
- **Tenant overlays via scoped class.** `:root` is the only binding
  point for now. A future RFC will extend with `[data-tenant="acme"]`
  rebindings.

## Acceptance criteria

- [x] `_tokens.scss` declares all intent token families.
- [x] `:root.dark` mirror block rebinds intents for dark mode.
- [x] `[data-density]` selectors rebind `--ep-control-height`.
- [x] `prefers-reduced-motion` flips `--ep-motion-scale: 0`.
- [x] `_mixins.scss` exposes `motion()` and `focus-ring-intent()` mixins.
- [x] `tailwind.css` `@theme inline` exposes intent utilities.
- [x] `ng build` green.
- [x] `vitest run` green (203 tests, 7 added in Sprint 1 across token consumers).

## References

- _tokens.scss — semantic intent layer (`SEMANTIC INTENT TOKENS (B.1)`)
- _mixins.scss — `motion()`, `focus-ring-intent()` mixins
- tailwind.css — `@theme inline` semantic intent bridge
