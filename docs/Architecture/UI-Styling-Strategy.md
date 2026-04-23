# UI Styling Strategy — PrimeNG + Tailwind hybrid

> **Date:** 2026-04-23
> **Decision:** **Adopt PrimeNG components + Tailwind v4 utilities with cssLayer ordering.**
> Status: **Already implemented** in `ClientApp/src/styles.css` and `ClientApp/src/app/config/primeng.config.ts`.
>
> **Companion docs.**
> - [`UI-Architecture.md`](UI-Architecture.md) — broader UI architecture
> - [`Architecture-Comparison-Analysis.md`](Architecture-Comparison-Analysis.md) — broader stack comparison
> - SPA design tokens: `ClientApp/src/styles/tokens.css`
> - SPA Tailwind theme bridge: `ClientApp/src/styles.css`

## 1. The two options framed

### Option A — Pure PrimeNG template (purchased)

Buy a commercial PrimeNG template (Sakai, Atlantis, Diamond, Apollo, Freya,
or similar from PrimeFaces). Use the template's:
- Pre-built layout (sidebar, top bar, breadcrumbs, footer)
- Theme system (Aura, Material, Lara presets — sometimes with custom variants)
- Pre-styled pages (dashboard, login, profile, error, 404)
- Color schemes / dark mode
- PrimeFlex (PrimeNG's CSS utility lib) or limited Tailwind integration

### Option B — PrimeNG components + Tailwind for all styling

Use PrimeNG strictly as a component library (forms, tables, dialogs, charts,
toast, etc.). Build all layouts / pages / chrome with Tailwind utilities.
Override PrimeNG defaults via:
- `cssLayer` order (Tailwind utilities loaded AFTER PrimeNG → win specificity ties without `!important`)
- PrimeNG's pass-through (`pt`) attribute API for per-component class injection
- PrimeNG's "unstyled mode" for components where the default is in the way

### What we already chose

Look at `ClientApp/src/app/config/primeng.config.ts`:

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primeng',
        order: 'tailwind-base, primeng, tailwind-utilities',
      },
    },
  },
  // ...
});
```

Layer order `tailwind-base, primeng, tailwind-utilities` IS the canonical
Option B implementation. Tailwind utilities cleanly override PrimeNG without
`!important` because they sit in a higher CSS layer.

## 2. Why Option B wins — comprehensive analysis

| Dimension | Option A (pure template) | Option B (PrimeNG + Tailwind) | Verdict |
|---|---|---|---|
| **Brand control** | Override the template's CSS — fragile, vendor-fights | Design tokens in `tokens.css` flow through Tailwind theme; PrimeNG inherits via `cssLayer` | **B** — full ownership |
| **Multi-tenant / white-label** | Per-tenant SCSS recompilation OR fight the template | Per-tenant CSS-variable overrides loaded at runtime | **B** — see §6 |
| **Responsive design** | Template's grid; constrained breakpoints | Tailwind's `sm/md/lg/xl/2xl` + container queries | **B** — better breakpoint scale |
| **Bundle size** | 200-500 KB CSS (template baseline) | 40-80 KB (Tailwind v4 JIT — only what you use) | **B** — 4-6× smaller |
| **Maintainability under PrimeNG upgrades** | Template breaks → wait for vendor patch | PrimeNG component upgrade; Tailwind layout untouched | **B** — decoupled |
| **Dark mode** | Template's preset (often 1-2 themes) | Tailwind v4 `dark:` modifier + PrimeNG's `darkModeSelector: '.dark'` aligned via design tokens | **Tie**, slight edge to B for token-driven swap |
| **Accessibility** | Template-built layouts; vendor's a11y story | Build accessible layouts yourself; PrimeNG's a11y for components is preserved | **Tie** — both viable |
| **Designer handoff (Figma → code)** | Designer adapts to template constraints | Designer's tokens map 1:1 to Tailwind theme | **B** — straight token translation |
| **Onboarding velocity (new dev)** | Fast first sprint; slow when customizing | Steeper start; consistent thereafter | **A** for first 2 weeks, **B** thereafter |
| **Vendor lock-in** | Tied to template + license + roadmap | Only PrimeNG's component API — replaceable | **B** |
| **License cost** | Per-developer, per-project (typical $79-$249) | Free (PrimeNG core is Apache 2.0; Tailwind is MIT) | **B** |
| **CSS specificity wars** | Frequent — overriding template selectors | Rare — `cssLayer` solves it architecturally | **B** |
| **Custom layouts (non-template patterns)** | Build from scratch ANYWAY | Build with Tailwind primitives | **Tie** — but B is consistent end-to-end |
| **Print stylesheets** | Template may or may not handle | Tailwind's `print:` modifier + custom CSS | **Tie** — both require effort |
| **RTL support** | Template-dependent | Tailwind v4 `rtl:` / `ltr:` modifiers + PrimeNG's `[dir="rtl"]` | **Tie** |
| **Animation** | Template-included presets | Tailwind v4 has built-in transition utilities; PrimeNG handles internal component animations | **Tie** |
| **CSS custom-property runtime swap** | Limited — usually requires SCSS recompile | First-class — change `:root` variable, instant repaint | **B** — see Option B's superpower |
| **Storybook integration** | Template wasn't designed for it | Tailwind utilities are storybook-native | **B** |
| **Testing visual regressions** | Lots of vendor styles in snapshots | Predictable, utility-class-based | **B** |
| **Long-term technical debt** | Templates die or get deprecated (see Apollo, etc.) | Tailwind is industry standard since 2020; PrimeNG component lib is stable | **B** |

**Score: ~17 wins for B, 1 for A (onboarding speed first 2 weeks), 5 ties.**

## 3. The ONE scenario where Option A actually wins

**Tight-deadline, single-tenant, single-brand internal tool with no
design-system future.** A 2-week MVP for an internal admin tool? Buy a
template, ship it. Don't overthink it.

In every other scenario, Option B is the better long-term choice — and the
reason it dominates is **CSS variable + cssLayer + utility-class composition
is the modern frontend pattern, period**. Tailwind v4 in particular
collapsed the gap between "use a UI kit" and "build your own design system."

## 4. How the integration actually works

### 4.1 Layer ordering — the keystone

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      cssLayer: {
        name: 'primeng',
        order: 'tailwind-base, primeng, tailwind-utilities',
      },
    },
  },
});
```

CSS `@layer` declarations stack in declaration order. The order string above
puts Tailwind utilities AFTER PrimeNG — so when both define a property
on the same selector, **Tailwind wins** (without `!important`).

### 4.2 Design tokens — single source of truth

```css
/* ClientApp/src/styles/tokens.css */
:root {
  --ep-color-primary-500: #2563eb;
  --ep-color-primary-600: #1d4ed8;
  /* ...full palette... */

  --ep-color-success: #16a34a;
  --ep-color-success-bg: #f0fdf4;

  --ep-radius-md: 0.5rem;
  --ep-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --ep-font-sans: 'Inter', system-ui, sans-serif;
}

:root.dark {
  --ep-color-primary-500: #3b82f6;
  /* ...dark-mode overrides... */
}
```

### 4.3 Tailwind theme bridge — `@theme inline`

```css
/* ClientApp/src/styles.css */
@import './styles/tokens.css';
@import 'tailwindcss';

@theme inline {
  --color-primary-500: var(--ep-color-primary-500);
  --color-success: var(--ep-color-success);
  --radius-ep-md: var(--ep-radius-md);
  --shadow-ep-md: var(--ep-shadow-md);
  --font-sans: var(--ep-font-sans);
}
```

The `inline` keyword tells Tailwind v4 to emit `var(--ep-color-primary-500)`
into the generated CSS instead of resolving to the value at build time. So
flipping `.dark` on `<html>` instantly repaints — **no rebuild, no flicker.**

### 4.4 Using utilities in templates

```html
<!-- Component template -->
<button class="bg-primary-500 hover:bg-primary-600 text-white rounded-ep-md
               px-4 py-2 shadow-ep-md transition-colors">
  Save
</button>

<!-- PrimeNG component with utility overrides -->
<p-button label="Save"
          class="!bg-primary-500 hover:!bg-primary-600">
</p-button>
```

The PrimeNG `p-button` accepts class overrides via the host. The `!` prefix
is no longer needed because `cssLayer` ordering handles specificity — but
it remains a safety net for selectors with deep PrimeNG nesting.

### 4.5 Pass-through (PT) API — surgical control

For PrimeNG components with deep internal structure (DataTable, Calendar,
TreeSelect), the pass-through API lets you target inner elements:

```html
<p-table [pt]="{
  root: { class: 'rounded-ep-lg shadow-ep-md' },
  thead: { class: 'bg-surface-100 dark:bg-surface-800' },
  bodyRow: { class: 'hover:bg-surface-50 transition-colors' },
  paginator: {
    root: { class: 'border-t border-surface-200' }
  }
}">
</p-table>
```

This is the modern PrimeNG approach and is **fully supported by the
library**. No CSS hacks, no `!important` chains.

### 4.6 Unstyled mode — when PT isn't enough

For a component you want to fully restyle:

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: { unstyled: true }   // disables ALL PrimeNG internal styles
  }
});
```

Use sparingly — usually a per-component override is enough. Unstyled mode
means YOU build the entire visual layer.

## 5. Multi-tenant / white-label patterns

This is where Option B's superiority is most pronounced.

### 5.1 Single-app, multi-brand (the SaaS case)

**Goal:** the same app instance serves customers Acme Corp and Beta Inc,
each seeing their own logo / colors / fonts.

**Pattern:**

```css
/* ClientApp/src/styles/tenants/acme-corp.css */
:root {
  --ep-color-primary-500: #ff6b35;   /* Acme's orange */
  --ep-color-primary-600: #e85a25;
  --ep-font-sans: 'Acme Display', system-ui, sans-serif;
}

/* ClientApp/src/styles/tenants/beta-inc.css */
:root {
  --ep-color-primary-500: #22c55e;   /* Beta's green */
  --ep-color-primary-600: #16a34a;
  --ep-font-sans: 'Beta Sans', system-ui, sans-serif;
}
```

**Loading:** at app boot, after the SPA reads `RUNTIME_CONFIG`:

```typescript
// In ThemeService or AppComponent
const tenantId = inject(AuthService).currentUser()?.tenantId;
if (tenantId) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/themes/${tenantId}.css`;
  document.head.appendChild(link);
}
```

Or, ship per-tenant `_tokens.css` from the BFF based on the host header:

```csharp
// BFF endpoint
[HttpGet("/themes/{tenantId}.css")]
public IActionResult GetTenantTheme(string tenantId, CancellationToken ct)
{
    var theme = _tenantThemeService.GetTokens(tenantId);
    return Content(theme, "text/css");
}
```

**Why this is hard with Option A:** the template's SCSS is compiled at
build time. To support N tenants, you'd ship N CSS bundles or compile a
"theme variable overlay" ad-hoc — both worse than a flat CSS-variable file.

### 5.2 Per-tenant logo / chrome assets

Same pattern via runtime config:

```typescript
// runtime-config.model.ts (already exists)
export const RuntimeConfigSchema = z.object({
  // ...
  branding: z.object({
    logoUrl: z.string().url(),
    productName: z.string(),
    primaryColor: z.string(),    // hex; bridges to --ep-color-primary-500
  }).optional(),
});
```

Update CSS variables at boot from the runtime config. PrimeNG inherits
through the design-token bridge — no PrimeNG code change needed.

### 5.3 White-label deployments (separate apps)

Same `dist/` artifact deployed at acme.app.com and beta.app.com, each
with its own `config.json` and `themes/<tenant>.css`. This pattern scales
to 100+ tenants from one codebase.

### 5.4 Per-tenant feature flags affecting style

```typescript
// SPA features.{tenantId}.json
{
  "ui.gradientButtons": true,
  "ui.darkModeDefault": false
}
```

Combine with conditional `class` bindings:

```html
<button [class.bg-gradient-to-r]="features.gradientButtons"
        [class.from-primary-500]="features.gradientButtons"
        [class.to-primary-700]="features.gradientButtons">
```

Tailwind utilities + Angular template bindings = trivially toggleable
per-tenant variants without conditional CSS.

## 6. Responsive design — Tailwind's superpower

### 6.1 Breakpoint scale (Tailwind v4 default)

| Token | Min width | Use case |
|---|---|---|
| `sm:` | 640px | Large phones / small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Small laptops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large desktops / wide monitors |

Customize per design system:

```css
@theme {
  --breakpoint-sm: 30rem;     /* 480px — large phones */
  --breakpoint-md: 48rem;     /* 768px */
  --breakpoint-lg: 64rem;     /* 1024px */
  --breakpoint-xl: 80rem;     /* 1280px */
  --breakpoint-2xl: 96rem;    /* 1536px */
  --breakpoint-3xl: 120rem;   /* 1920px — ultrawide */
}
```

### 6.2 Container queries (Tailwind v4 first-class)

```html
<!-- Card that adapts to its CONTAINER, not the viewport -->
<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4">
    <!-- cards reflow based on the parent container's width -->
  </div>
</div>
```

This is huge for component-driven design — a card that's responsive to its
slot, regardless of where the page lays it out.

### 6.3 Fluid typography

```html
<h1 class="text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl">
```

Or modern fluid scaling via `clamp()`:

```css
@theme {
  --text-fluid-xl: clamp(1.5rem, 3vw, 2.5rem);
}
```

```html
<h1 class="text-fluid-xl">
```

### 6.4 Mobile-first as a discipline

Tailwind enforces mobile-first by default — `md:` is "AT or above 768px",
so the unprefixed class is the mobile baseline. This catches "we forgot
mobile" issues at design time, not in QA.

## 7. Edge cases — when PrimeNG components push back

### 7.1 DataTable

The biggest, most complex PrimeNG component. The PT API works but is
verbose. **Pattern:** wrap it in a feature-specific `<app-data-table>`
component that centralizes PT styling:

```typescript
// shared/components/data-table/data-table.component.ts
@Component({
  selector: 'app-data-table',
  template: `
    <p-table [pt]="tablePt" [value]="value()" ...>
      <ng-content />
    </p-table>
  `,
})
export class DataTableComponent<T> {
  readonly value = input.required<T[]>();

  readonly tablePt = signal({
    root: { class: 'rounded-ep-lg shadow-ep-sm' },
    thead: { class: 'bg-surface-100 dark:bg-surface-800' },
    bodyRow: { class: 'hover:bg-surface-50 transition-colors' },
  });
}
```

Now every consumer gets a consistent table without re-applying PT classes.

### 7.2 Calendar / DatePicker

Often easier to **accept PrimeNG's defaults** — they're clean and the
internal structure is hostile to CSS overrides. If you must restyle,
write a dedicated wrapper component AND budget extra time.

### 7.3 Toasts / Dialogs / Tooltips (portaled to body)

These are appended to `<body>`, so they live OUTSIDE your component tree.
Tailwind's utility classes still work because they're global, BUT keep
two things in mind:

1. **Dark mode propagation:** the portaled element doesn't sit inside your
   `.dark` ancestor by default. PrimeNG handles this — its
   `darkModeSelector: '.dark'` looks at `<html>`, not the parent — so
   PrimeNG components in portals respect dark mode.
2. **Custom CSS scoping:** if you write component-scoped CSS (`:host`),
   it won't reach the portaled DOM. Use `::ng-deep` sparingly OR put
   portal-target styles in a global stylesheet.

### 7.4 Form controls (Input, Select, Calendar)

PrimeNG form controls have specific structures (label, input, error
message, helper text). Two approaches:

- **Use `inputStyle: 'outlined'`** (already configured) and style with
  Tailwind for surrounding chrome (label color, helper text margin)
- **Build your own form-control wrapper** that uses native `<input>` +
  Tailwind. Lose PrimeNG validation hookups, but gain full control.

The first approach is the practical choice — lets PrimeNG handle the
hard parts (focus management, validation message wiring, accessibility)
and Tailwind handle visual polish.

### 7.5 Animations

PrimeNG has its own animation system for component internals (modal
in/out, dropdown collapse). Tailwind has `transition-*` utilities for
your own elements. **Don't fight PrimeNG's animations** — let them be.
Use Tailwind for non-PrimeNG transitions.

### 7.6 Print styles

Both ecosystems handle print:

- PrimeNG: provides minimal print styles for some components
- Tailwind: `print:` modifier (e.g. `print:hidden`, `print:text-black`)

For a printable report:

```html
<header class="print:hidden">...</header>
<main class="print:bg-white print:text-black">
  ...
</main>
```

### 7.7 RTL (Arabic, Hebrew)

Both libraries support RTL:

- PrimeNG: respects `[dir="rtl"]` on `<html>`
- Tailwind v4: `rtl:` and `ltr:` modifiers (e.g. `rtl:ml-auto ltr:mr-auto`)

Set `<html dir="rtl">` based on user locale; both libraries flip together.

### 7.8 Custom focus ring

Already handled in the existing `styles.css`:

```css
:focus-visible {
  outline: none;
  box-shadow: var(--ep-shadow-focus);
  border-radius: var(--ep-radius-md);
}
```

This applies globally to native + PrimeNG inputs alike. **Don't override
PrimeNG's focus management JS** — just style the visible outcome.

## 8. Domain-specific scenarios

### 8.1 Healthcare (HIPAA UI requirements)

- **Auto-logoff dialog** styling matters for legal-compliance optics —
  use design tokens to ensure the warning color is consistent and
  prominent
- **PHI redaction display** — semantic color tokens (`--ep-color-warning`)
  for "redacted" states; survives tenant theme swaps
- **Print stylesheets** for record discharge — Tailwind's `print:` is
  essential

### 8.2 Finance (SOX UI requirements)

- **Audit trail UI** must be tamper-evident in appearance — use a distinct
  semantic color (`--ep-color-info-bg`) and rounded corners that
  visually distinguish from editable areas
- **Dual approval flows** — color-coded action buttons (`--ep-color-warning`
  for the second approver) using design tokens
- **Read-only state** styling for entries past their amend window — use
  `aria-readonly` + `cursor-not-allowed` + `opacity-60`

### 8.3 HR (GDPR UI requirements)

- **Consent dialogs** — branded per tenant (logo, color), so swap via the
  per-tenant CSS pattern in §5
- **Right-to-erasure UI** — dangerous-action red theme (`--ep-color-danger`),
  consistent across all tenants
- **Field-level encryption indicators** — small lock icons next to
  encrypted fields; accessible via `aria-label` and tinted using design
  tokens

### 8.4 Public-sector (accessibility / 508 compliance)

- **High-contrast theme** via per-tenant CSS overrides — same pattern as
  white-label; just one of the loadable themes
- **Focus indicators** must be visible at WCAG AAA contrast — already
  covered by the global `:focus-visible` style
- **Color is not the only signifier** — Tailwind utilities make it easy
  to add icons + text alongside color (e.g. `text-success` + `<i pi pi-check>` icon)

## 9. Performance characteristics

### 9.1 Bundle size

| Asset | Option A (template) | Option B (PrimeNG + Tailwind) |
|---|---|---|
| CSS (initial load) | 200-500 KB | 40-80 KB (JIT) |
| CSS (gzipped) | 30-80 KB | 6-12 KB |
| JS overhead | identical (PrimeNG components) | identical |

Phase 7's bundle measurement showed Tailwind v4 + PrimeNG 21 emits
~42 KB CSS (initial) for the SPA's current surface — comparable to
hand-coded SCSS.

### 9.2 Runtime cost

- **PT API** — tiny per-render overhead; Angular bindings, immeasurable
- **CSS variable resolution** — browser native; faster than recompiling SCSS
- **Theme swap (dark mode, tenant change)** — one DOM mutation
  (`document.documentElement.classList.toggle('dark')`); instant repaint

### 9.3 First Contentful Paint (FCP)

Tailwind v4's smaller CSS = faster FCP. Particularly noticeable on
mobile / 4G.

## 10. Tooling & developer experience

### 10.1 IDE support

- **Tailwind CSS IntelliSense** (VS Code extension) — autocomplete for
  every utility class, including custom `@theme` tokens
- **PrimeNG types** — TypeScript definitions for `pt` attribute shapes
- **Storybook** — works seamlessly with Tailwind utilities; stories
  render with full styling

### 10.2 Linting

- **Tailwind class sorting** via `prettier-plugin-tailwindcss` (consistent
  utility order)
- **`eslint-plugin-tailwindcss`** for class validation

### 10.3 Discovering tokens

```bash
# What tokens are available?
cat ClientApp/src/styles/tokens.css | grep "^  --"

# What Tailwind classes do they expose?
cat ClientApp/src/styles.css | grep "^  --color\|--radius\|--shadow"
```

## 11. Implementation conventions (locked-in)

The following are existing conventions in the SPA that should be preserved:

| Concern | Convention |
|---|---|
| **Custom design tokens** | Define in `styles/tokens.css` with `--ep-` prefix |
| **Tailwind theme bridge** | Map via `@theme inline` in `styles.css` (use `inline` for runtime swap) |
| **Dark mode** | `.dark` class on `<html>`; toggle via `ThemeService` |
| **PrimeNG cssLayer** | `tailwind-base, primeng, tailwind-utilities` order — **don't change** |
| **Per-tenant theming** | Load `/themes/{tenantId}.css` at boot, override `:root` variables only |
| **Component-internal PrimeNG styling** | Use `pt` attribute, NOT global selectors |
| **Animation** | PrimeNG handles component internals; Tailwind for app-level transitions |
| **Focus ring** | Global `:focus-visible` in `styles.css` — applies to all inputs |
| **Z-index** | Configured in `primeng.config.ts` zIndex map; don't introduce arbitrary `z-` values |
| **Spacing / sizing** | Tailwind scale (`p-4`, `gap-2`, etc.) — NOT pixels in templates |
| **Colors in templates** | Token-bridged classes (`bg-primary-500`, `text-success`) — NOT hex literals |

## 12. What NOT to do

- ❌ **Don't add a global stylesheet override per component** — use `pt` API
- ❌ **Don't use `!important`** unless `cssLayer` already failed (rare)
- ❌ **Don't use `::ng-deep`** for PrimeNG overrides — use `pt`
- ❌ **Don't load PrimeNG themes from CDN** — bundled assets ride the build pipeline
- ❌ **Don't store hex colors in components** — design tokens only
- ❌ **Don't conditional-import a CSS framework per tenant** — use CSS variables for runtime swap
- ❌ **Don't write tenant-specific Angular components** — same components, different design tokens

## 13. Recommendations & next actions

### 13.1 Already in place ✅

- PrimeNG + Tailwind cssLayer ordering
- Design token system (`tokens.css`)
- `@theme inline` bridge for runtime swap
- Dark mode wiring
- Aura preset with z-index map
- Global focus-visible style

### 13.2 Worth adding (if not already)

- [ ] **`ThemeService`** that toggles `.dark` on `<html>` + persists in localStorage
- [ ] **Per-tenant theme loader** as outlined in §5.1 (when first multi-tenant client lands)
- [ ] **`<app-data-table>` wrapper** centralizing PrimeNG DataTable PT styling
- [ ] **Storybook stories** for each token (palette swatches, spacing scale)
- [ ] **Visual-regression tests** (Chromatic / Playwright screenshot diffs) for key components
- [ ] **Print stylesheets** for any reports / invoices
- [ ] **High-contrast theme variant** for accessibility (508 compliance)
- [ ] **Documentation page** in Storybook explaining the design-token convention

### 13.3 Future-proofing

- **Tailwind v5** — when it ships, the `@theme inline` pattern should
  carry forward. Re-evaluate breakpoint defaults at upgrade time.
- **PrimeNG v22+** — the PT API is stable; `unstyled` mode is stable.
  Watch for breaking changes in component DOM structure (could affect
  PT selectors).
- **CSS @scope** — when browser support solidifies, consider scoping
  utility-class injection to component boundaries for cleaner separation.

## 14. Final recommendation

**Stay the course.** The current implementation is the modern, correct
approach. Don't be tempted by a purchased template — every long-term
benefit (multi-tenant, white-label, design-system fidelity, bundle size,
maintainability) accrues to the current architecture.

If anyone proposes "let's just buy template X to ship faster":

1. Show them this doc
2. Point at `ClientApp/src/styles.css` — the foundation is built
3. Estimate the cost of unwinding tenant-specific theming from a template
   later (it's much higher than the perceived savings)

The 1-week velocity advantage of a purchased template doesn't survive
the first customization request, the first multi-tenant requirement, or
the first PrimeNG major upgrade.

---

**Companion docs:**
- [`Architecture-Comparison-Analysis.md`](Architecture-Comparison-Analysis.md) — broader architecture comparison
- [`UI-Architecture.md`](UI-Architecture.md) — full UI architecture
- [`../Recreation/06-BFF-And-Frontend-Flow.md`](../Recreation/06-BFF-And-Frontend-Flow.md) — frontend interceptor chain
- `ClientApp/src/styles/README.md` — design tokens reference
- `ClientApp/src/app/config/primeng.config.ts` — PrimeNG configuration

## 15. Decision log

| Date | Decision | Rationale | By |
|---|---|---|---|
| Phase 5 (initial) | PrimeNG + Tailwind hybrid | Long-term flexibility | Tech lead |
| 2026-04-23 | Decision documented | Reference for future debates | This doc |
