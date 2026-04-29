# `src/styles/` — Global stylesheets

Two global stylesheets are emitted at build time, listed in `angular.json`
`styles[]` in this order:

1. `styles.scss` — Sass entry (partials + primeicons font CSS)
2. `tailwind.css` — Tailwind v4 directive + `@theme inline` token bridge

The split exists because Sass 1.99+ deprecates the bare `@import 'tailwindcss'`
form (becomes a hard error in Sass 3.0). Keeping Tailwind out of the Sass
pipeline routes its directive through PostCSS only — `@tailwindcss/postcss`
processes any `.css` file in the bundle (configured globally in
`.postcssrc.json`).

```
src/styles/
├── styles.scss               ← Sass entry · referenced first by angular.json styles[]
├── tailwind.css              ← Tailwind v4 entry · referenced second by styles[]
├── _tokens.scss              ← --ep-* CSS custom properties (colors, radii,
│                                spacing, shadows, z-index, transitions,
│                                layout dims, typography) on :root +
│                                :root.dark overrides
├── _typography.scss          ← @font-face declarations (mostly placeholder
│                                pending licensed Arno Pro / Bicycletter)
├── _animations.scss          ← @keyframes + .ep-fade-in / .ep-scale-in
│                                utility classes + the global
│                                @media (prefers-reduced-motion) rule
├── _reset.scss               ← html/body baseline, :focus-visible ring,
│                                @media print reset, chrome interaction
│                                guards (touch-action, tap-highlight)
├── _primeng-overrides.scss   ← global PrimeNG `.p-*` overrides — populated
│                                in Phase 3 from component extractions
├── _mixins.scss              ← reusable mixins: dark, mobile, tablet-down,
│                                desktop, focus-ring
└── README.md
```

## Composition order

```scss
// styles.scss (Sass entry)
@use 'tokens';            // 1. CSS custom properties (must be first — others reference)
@use 'typography';        // 2. @font-face
@use 'animations';        // 3. keyframes + reduced-motion safeguard
@use 'reset';             // 4. baseline + chrome guards
@use 'primeng-overrides'; // 5. global PrimeNG overrides

@import 'primeicons/primeicons.css';   // PrimeIcons font + .pi-* glyph classes
```

```css
/* tailwind.css (plain CSS, processed by @tailwindcss/postcss only) */
@import 'tailwindcss';                  /* generates theme/base/utilities layers */

@theme inline { ... }                   /* aliases --ep-* → theme scale */
```

The `--ep-*` custom properties declared by `_tokens.scss` apply to `:root`,
so they're visible to `tailwind.css`'s `@theme inline` block — both files
share the same global token namespace.

## How components use these partials

Component SCSS files import only `mixins`:

```scss
// shared/components/dph/panel.component.scss
@use 'mixins' as m;

.dph-panel__close:focus-visible {
  @include m.focus-ring;
}

.dph-panel--mobile-stack {
  @include m.mobile {
    flex-direction: column;
  }
}
```

The Sass `includePaths: ["src/styles"]` setting in `angular.json` lets
`@use 'mixins'` resolve without relative paths from any component file.

## What lives where (rules)

| Concern | Goes in |
|---|---|
| New CSS custom property (design token) | `_tokens.scss` |
| New `@font-face` for licensed font | `_typography.scss` |
| New keyframe animation | `_animations.scss` |
| New `:root` / `html` / `body` rule | `_reset.scss` |
| New `.p-*` PrimeNG override | `_primeng-overrides.scss` |
| New reusable mixin (3+ usages) | `_mixins.scss` |
| Component-specific styling | `<component>.component.scss` next to the .ts file |

## Cascade layer order

PrimeNG declares the layer order via `cssLayer.order: 'theme, base, primeng, utilities'`
in `src/app/config/primeng.config.ts`. Tailwind v4's `@import 'tailwindcss'`
populates `theme`, `base`, and `utilities`; PrimeNG components live in
`primeng`. Our overrides in `_primeng-overrides.scss` are layer-LESS
(intentional) so they beat PrimeNG defaults without `!important`.

## Why `@use` not `@import`

Sass `@import` is deprecated and module-leaky (variables and mixins flow
into the global scope). `@use` is module-scoped (`@use 'mixins' as m;` →
prefix everything with `m.`) and deduplicates — even if 50 components
`@use 'mixins'`, Sass compiles the partial once.
