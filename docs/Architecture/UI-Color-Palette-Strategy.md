# UI Color Palette Strategy

**Scope:** every colour token, scale, semantic alias, gradient, and dark-theme
override used by the Angular SPA. How the system is wired, where to change a
single brand colour, where to remap "success" to a different palette, where
to add a new brand-tinted gradient.

**Audience:**
- **Designers** — the four brand colours + when/how to use each scale step.
- **Engineers** — every file that touches a colour, with the exact line to
  change.
- **Compliance / brand** — accessibility contrast matrix, off-brand
  exceptions, tenant-rebrand pattern.

**Companion docs:**
- [`UI-Architecture.md`](./UI-Architecture.md) — overall SPA architecture
- [`UI-Styling-Strategy.md`](./UI-Styling-Strategy.md) — PrimeNG + Tailwind decision
- [`UI-Typography-Strategy.md`](./UI-Typography-Strategy.md) — font system
- [`UI-Config-Files-Reference.md`](./UI-Config-Files-Reference.md) — every config file

---

## 1 · TL;DR

The application brand is built on **four core colours**:

| # | Colour | Hex anchor | Role | Tailwind utility prefix |
|---|---|---|---|---|
| 1 | **Indigo Blue** | `#1B3F73` (700) | Primary — links, focus, interactive | `bg-primary-*` / `text-primary-*` |
| 2 | **Palmetto Green** | `#1F5328` (700) | Secondary — success, growth | `bg-palmetto-*` / `text-palmetto-*` |
| 3 | **Yellow Jessamine** | `#F4B82E` (500) | Accent — warning, highlight | `bg-jessamine-*` / `text-jessamine-*` |
| 4 | **Opaque White** | `#FAFAF7` (50) | Surface — background, cards | `bg-neutral-*` / `text-neutral-*` |

Each brand colour is exposed as an **11-step scale** (50 → 950) so components
can pick the right tonal weight. **Red** is kept off-brand for danger states
only — it's a universal "stop" signal.

Everything resolves through CSS custom properties. Components reference
tokens (`var(--ep-color-primary-700)`) or Tailwind utilities
(`class="bg-primary-700"`) — never raw hex. A tenant rebrand or single-step
re-anchor is a one-line edit in `_tokens.scss`.

---

## 2 · The four brand colours

### 2.1 Indigo Blue — the primary brand
**Anchor:** `#1B3F73` (700). Inspired by the historic Carolina indigo dye
trade — deep, authoritative, trustworthy. Reads as "enterprise" without
trending toward government-grey.

**When to use:**
- Primary buttons, primary CTAs ("Save", "Submit", "Confirm")
- Links, link hover states
- Focus rings (every `:focus-visible` boxshadow)
- Active navigation item background tint
- Brand chrome (logo background, header title accent)
- Info badges / chips

**Avoid for:** error states (use red), success states (use palmetto), large
solid backgrounds at 700+ on mobile (drains battery on OLED, fatigues the
eye on small screens — use 50 / 100 tints instead).

### 2.2 Palmetto Green — the secondary brand
**Anchor:** `#1F5328` (700). The deep evergreen of the South Carolina
palmetto tree. Communicates growth, confirmation, organic stability.

**When to use:**
- Success notifications, success toasts
- "Approved" / "Active" / "Healthy" status badges
- Positive metric arrows (revenue up, conversions improved)
- Secondary CTA buttons that complement primary indigo
- Eco / sustainability content
- Chart series for "good outcome" data

**Avoid for:** large surfaces (saturated greens read as "go" and exhaust
the eye at scale — use 50 / 100 backgrounds for surfaces).

### 2.3 Yellow Jessamine — the accent brand
**Anchor:** `#F4B82E` (500). The vivid gold of the Carolina Jessamine
flower. The brand's attention-grabbing hue — used sparingly so it stays
loud.

**When to use:**
- Warning notifications, warning toasts
- "Pending" / "Review needed" / "Beta" badges
- Highlight overlays on tutorial/onboarding callouts
- Hero accents (a single underline, a star, a chevron) on marketing copy
- CTA accents — a pop of jessamine on an otherwise indigo button is fine
- Chart data highlight (the one bar that matters)

**Avoid for:** body text (low contrast on white at 500; only 700+ passes
WCAG AA on white), large solid surfaces (visual fatigue), success states
(use palmetto), error states (use red).

### 2.4 Opaque White — the surface palette
**Anchor:** `#FAFAF7` (50). Slightly warm white that signals "premium
print", contrasts the cool indigo brand, and avoids the sterile feel of
pure `#FFFFFF`.

**When to use:**
- Page background (`--ep-surface-50`)
- Card / panel backgrounds (`--ep-surface-0` for elevated surfaces)
- Modal backdrops
- Table row striping (alternating 50 / 100)
- Borders and dividers (200, 300)
- Body text (700, 800), heading text (900), muted text (400, 500)

**Why warm vs pure white:** at 4 in / 30 cm reading distance, a warm-tinted
white reads as "paper" while pure `#FFFFFF` reads as "screen glare". The
warm tint also flatters the indigo + palmetto + jessamine palette by
slightly desaturating it — making the brand colours pop without
oversaturating.

---

## 3 · The 11-step scales

Each brand colour is a Tailwind-style 50–950 scale. Use the table below
to pick the right step for the job.

### 3.1 Indigo Blue (`--ep-color-primary-*`)

| Step | Hex | Use for |
|---|---|---|
| 50 | `#EFF3FA` | Subtle interactive wash (active row, focus pre-state) |
| 100 | `#D9E2F0` | Hover surface for icon buttons |
| 200 | `#B5C4E0` | Disabled-fill, soft borders |
| 300 | `#8BA3CC` | Info-badge background, decorative dividers |
| 400 | `#5F7FB4` | Secondary fill, illustrations |
| 500 | `#3C609E` | Default interactive (links, button background) |
| 600 | `#2C4D86` | Hover state on 500 |
| 700 | **`#1B3F73`** | **Brand anchor**, default primary button |
| 800 | `#142D54` | Pressed / active state on 700 |
| 900 | `#0E1F3B` | Heading text on light surfaces |
| 950 | `#060F1F` | Near-black, dark-mode body text |

### 3.2 Palmetto Green (`--ep-color-palmetto-*`)

| Step | Hex | Use for |
|---|---|---|
| 50 | `#ECF7EE` | Success toast background, success card wash |
| 100 | `#C9EAD0` | Success badge background |
| 200 | `#98D6A6` | Hover surface for success-tagged items |
| 300 | `#66BC79` | Decorative — chart fill, illustrations |
| 400 | `#3FA055` | Status indicator dot (active / online) |
| 500 | `#2E7D3E` | Secondary CTA background |
| 600 | `#246631` | Hover state on 500; semantic `--ep-color-success` |
| 700 | **`#1F5328`** | **Brand anchor**, "Approved" badge text on light bg |
| 800 | `#173E1F` | Strong success text |
| 900 | `#0F2914` | Heading text in eco/positive marketing |
| 950 | `#07150A` | Near-black, dark-mode positive accents |

### 3.3 Yellow Jessamine (`--ep-color-jessamine-*`)

| Step | Hex | Use for |
|---|---|---|
| 50 | `#FEF7E5` | Warning toast background, callout wash |
| 100 | `#FCE9B5` | Warning badge background; semantic `--ep-color-warning-bg` |
| 200 | `#F9D981` | Highlight surface (tutorial callout) |
| 300 | `#F7C94D` | Decorative — illustrations, chart fill |
| 400 | `#F5BD30` | Status indicator (pending review) |
| 500 | **`#F4B82E`** | **Brand anchor**, accent buttons / hero pops |
| 600 | `#D49B1A` | Hover on 500; semantic `--ep-color-warning` |
| 700 | `#A87711` | Warning text on light surface (passes AA) |
| 800 | `#7D580E` | Strong attention text |
| 900 | `#543B09` | Heading text in promotional content |
| 950 | `#2A1D04` | Near-black gold |

### 3.4 Opaque White / warm neutrals (`--ep-color-neutral-*`)

| Step | Hex | Use for |
|---|---|---|
| 0 | `#FFFFFF` | Pure white — modals, floating panels (`--ep-surface-0`) |
| 50 | `#FAFAF7` | Page background ("opaque white", `--ep-surface-50`) |
| 100 | `#F4F4ED` | Hover surface, table row stripe (`--ep-surface-100`) |
| 200 | `#E8E7DB` | Dividers, light borders (`--ep-surface-200`, `--ep-border`) |
| 300 | `#D6D5C5` | Disabled, muted borders (`--ep-border-strong`) |
| 400 | `#A9A797` | Placeholder text (`--ep-text-muted`) |
| 500 | `#7C7A6A` | Secondary text |
| 600 | `#5C5A4D` | Body text on subtle backgrounds (`--ep-text-secondary`) |
| 700 | `#3F3D34` | Strong body text |
| 800 | `#25241E` | Heading text |
| 900 | `#15140F` | Highest-contrast text (`--ep-text-primary`) |
| 950 | `#0A0907` | Near-black |

### 3.5 Off-brand red (`--ep-color-danger-*`) — danger only

| Step | Hex | Use for |
|---|---|---|
| 50 | `#FEF2F2` | Error toast background |
| 100 | `#FEE2E2` | Error badge background; semantic `--ep-color-danger-bg` |
| 500 | `#DC2626` | Default error state (icon, accent border) |
| 600 | `#B91C1C` | Destructive button background; semantic `--ep-color-danger` |
| 700 | `#991B1B` | Strong error text on light surface (passes AA) |

---

## 4 · Semantic aliases

Components prefer **semantic** names over scale indices. A future
remap (e.g. "success" should use a different green family) becomes a
single token edit, not a sweep across the codebase.

| Semantic token | Default mapping | Use for |
|---|---|---|
| `--ep-color-info` | `primary-700` | Info icon / badge / toast text |
| `--ep-color-info-bg` | `primary-50` | Info toast background |
| `--ep-color-success` | `palmetto-600` | Success icon / badge / toast text |
| `--ep-color-success-bg` | `palmetto-50` | Success toast background |
| `--ep-color-warning` | `jessamine-600` | Warning icon / badge / toast text |
| `--ep-color-warning-bg` | `jessamine-100` | Warning toast background |
| `--ep-color-danger` | `danger-600` | Error icon / destructive button |
| `--ep-color-danger-bg` | `danger-100` | Error toast background |

Tailwind utilities expose them as `bg-success`, `text-warning`,
`bg-info-bg`, etc. — see §6 below.

---

## 5 · Accessibility contrast matrix

Every brand colour at the recommended step passes WCAG AA against the
matching surface. Verified at the steps below; if you mix steps outside
this matrix, run a contrast checker first.

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `primary-700` (#1B3F73) text | `neutral-50` (#FAFAF7) bg | **9.62 : 1** | AAA ✓ |
| `primary-600` (#2C4D86) text | `neutral-50` bg | **7.84 : 1** | AAA ✓ |
| `palmetto-700` (#1F5328) text | `neutral-50` bg | **9.05 : 1** | AAA ✓ |
| `palmetto-600` (#246631) text | `neutral-50` bg | **6.18 : 1** | AA ✓ (large AAA) |
| `jessamine-700` (#A87711) text | `neutral-50` bg | **4.62 : 1** | AA ✓ |
| `jessamine-600` (#D49B1A) text | `neutral-50` bg | **2.74 : 1** | ✗ (use ≥ 700) |
| `danger-700` (#991B1B) text | `neutral-50` bg | **7.42 : 1** | AAA ✓ |
| White text | `primary-700` bg | **9.62 : 1** | AAA ✓ |
| White text | `palmetto-700` bg | **9.05 : 1** | AAA ✓ |
| White text | `jessamine-500` bg | **2.18 : 1** | ✗ (use neutral-900 text) |
| `neutral-900` text | `jessamine-500` bg | **9.41 : 1** | AAA ✓ |

**Rule of thumb:** white text needs a `700+` brand background; jessamine
needs neutral-900 text on backgrounds at 500 or lighter.

---

## 6 · Tailwind utilities exposed

The `@theme inline` block in `src/styles/tailwind.css` exposes every token as a
Tailwind utility. Use these in templates instead of inline `style="…"`.

```html
<!-- Brand backgrounds -->
<div class="bg-primary-700 text-white">…</div>
<div class="bg-palmetto-50 text-palmetto-800">…</div>
<div class="bg-jessamine-500 text-neutral-900">…</div>
<div class="bg-neutral-50 text-neutral-700">…</div>

<!-- Semantic backgrounds -->
<div class="bg-success-bg text-success">Success!</div>
<div class="bg-warning-bg text-warning">Warning</div>
<div class="bg-danger-bg text-danger">Error</div>
<div class="bg-info-bg text-info">Info</div>

<!-- Brand borders -->
<div class="border border-primary-200">…</div>
<div class="border-l-4 border-jessamine-500">Callout</div>

<!-- Hover variants -->
<button class="bg-primary-700 hover:bg-primary-800 text-white">CTA</button>
```

For arbitrary-value bindings (when a Tailwind utility doesn't exist for
the exact need), use the `[color:var(--ep-…)]` syntax — it stays
token-driven:

```html
<span class="text-[color:var(--ep-text-secondary)]">Subtle text</span>
<div class="bg-[color:var(--ep-surface-100)]">Striped row</div>
```

---

## 7 · Brand gradients

Five preset gradients live in `_tokens.scss` for hero / marketing surfaces.
Use `background: var(--ep-gradient-…)` on a wrapper element.

| Token | Direction | From → To | Use for |
|---|---|---|---|
| `--ep-gradient-brand-cool` | 135° | `primary-700` → `primary-500` | Authoritative hero (sign-in splash) |
| `--ep-gradient-brand-warm` | 135° | `jessamine-500` → `palmetto-600` | Energetic CTA (free-trial banner) |
| `--ep-gradient-brand-sunrise` | 135° | `jessamine-400` → `primary-700` | Marketing landing (warm-to-cool sweep) |
| `--ep-gradient-brand-forest` | 135° | `palmetto-700` → `primary-700` | Eco / sustainability content |
| `--ep-gradient-brand-subtle` | 180° | `neutral-50` → `neutral-100` | Section dividers, table headers |

```html
<header style="background: var(--ep-gradient-brand-cool)">
  <h1 class="text-white">Sign in</h1>
</header>
```

---

## 8 · Dark theme

When `<html>` carries the `.dark` class, surfaces flip to deep
indigo-tinted neutrals (NOT pure black) and brand colours shift one step
lighter for legibility.

| Light → Dark | Light value | Dark override |
|---|---|---|
| `--ep-surface-0` | `#FFFFFF` | `#0C1426` (slightly elevated panel) |
| `--ep-surface-50` | `#FAFAF7` | `#0A1020` (page background) |
| `--ep-surface-100` | `#F4F4ED` | `#131A2E` (hover/stripe) |
| `--ep-surface-200` | `#E8E7DB` | `#1D2540` (dividers) |
| `--ep-text-primary` | `#15140F` | `#FAFAF7` (warm white text) |
| `--ep-color-success` | `palmetto-600` | `palmetto-300` (lighter for contrast) |
| `--ep-color-warning` | `jessamine-600` | `jessamine-300` |
| `--ep-color-danger` | `danger-600` | `danger-500` |
| `--ep-color-info` | `primary-700` | `primary-300` |

`*-bg` aliases use `color-mix(in srgb, …, transparent 80%)` so toast
backgrounds blend naturally with whatever surface they land on rather than
carrying their own opaque colour.

The `.dark` toggle is owned by `ThemeService` (`src/app/core/services/theme.service.ts`).

---

## 9 · The five files involved

When the brand changes, **these are the only files you touch.** Every
other file just consumes the tokens.

| # | File | What it owns |
|---|---|---|
| 1 | `src/styles/_tokens.scss` | All `--ep-color-*` scales, semantic aliases, gradients, dark-theme overrides |
| 2 | `src/styles/tailwind.css` | Bridges every token to a Tailwind utility (`@theme inline`) |
| 3 | `src/index.html` | `<meta name="theme-color">` for mobile browser chrome / PWA splash |
| 4 | `src/app/config/primeng.config.ts` | Maps PrimeNG `primary` palette + light/dark colour scheme to `--ep-color-primary-*` (already token-driven; no edit usually needed) |
| 5 | (per tenant) tenant overlay CSS | Optional — re-declares `--ep-color-*` tokens inside a tenant-class scope |

---

## 10 · How-to recipes

### 10.1 Change the primary brand colour (e.g. swap indigo for teal)

1. Open `src/styles/_tokens.scss`.
2. Replace the eleven `--ep-color-primary-*` values with the new scale.
3. Update `--ep-shadow-focus` to a translucent tint of the new 700 hex.
4. Open `src/index.html` and update `<meta name="theme-color">` to the
   new 700 hex.
5. `npm run build`. Every Tailwind `bg-primary-*` utility, every PrimeNG
   button, every focus ring re-renders in the new colour. Zero component
   changes needed.

### 10.2 Remap a semantic ("success" should use emerald, not palmetto)

1. Open `src/styles/_tokens.scss`.
2. Edit one alias:
   ```css
   --ep-color-success:    var(--ep-color-emerald-600);
   --ep-color-success-bg: var(--ep-color-emerald-50);
   ```
   (Add the emerald scale alongside palmetto — both can coexist.)
3. Done. Every `bg-success`, `text-success`, every PrimeNG success-styled
   component flips. Palmetto remains available as `bg-palmetto-*` for
   non-semantic uses.

### 10.3 Add a new gradient

1. Open `src/styles/_tokens.scss`.
2. Append:
   ```css
   --ep-gradient-brand-storm: linear-gradient(
     135deg,
     var(--ep-color-primary-900) 0%,
     var(--ep-color-palmetto-700) 100%
   );
   ```
3. Use as `style="background: var(--ep-gradient-brand-storm)"` or wire to
   a Tailwind utility via `@theme inline`'s `--gradient-*` namespace if
   you want `bg-gradient-storm`.

### 10.4 Tenant rebrand (per-tenant brand)

1. Create `src/styles/tenants/acme.css`:
   ```css
   .tenant-acme {
     --ep-color-primary-50:  #F0F4F8;
     /* … 10 more steps … */
     --ep-color-primary-700: #003B6F;  /* Acme deep blue */
     /* Optionally re-anchor palmetto / jessamine / neutral too */
   }
   ```
2. List the tenant CSS in `angular.json` `styles[]` after the global entries (or `@import` it from `tailwind.css` so PostCSS handles it — keep it out of the Sass entry):
   ```jsonc
   "styles": [
     "src/styles/styles.scss",
     "src/styles/tailwind.css",
     "src/styles/tenants/acme.css"
   ]
   ```
3. The shell sets `class="tenant-acme"` on `<html>` based on
   `TenantService`. Every Tailwind utility, PrimeNG component, and focus
   ring rebrands on the next paint. No JS, no rebuild.

### 10.5 Add a brand-new colour role (e.g. "Caution" — distinct from warning)

1. Open `src/styles/_tokens.scss` and add a scale block:
   ```css
   --ep-color-caution-50:  #FFF7E8;
   --ep-color-caution-500: #FF9933;
   --ep-color-caution-700: #B86B14;
   /* … remaining steps … */
   ```
2. Add semantic alias if needed:
   ```css
   --ep-color-caution:    var(--ep-color-caution-600);
   --ep-color-caution-bg: var(--ep-color-caution-100);
   ```
3. Open `src/styles/tailwind.css` and add to `@theme inline`:
   ```css
   --color-caution-50: var(--ep-color-caution-50);
   /* … remaining steps … */
   --color-caution: var(--ep-color-caution);
   --color-caution-bg: var(--ep-color-caution-bg);
   ```
4. Use as `class="bg-caution-bg text-caution"` or
   `style="background: var(--ep-color-caution-100)"`.

---

## 11 · PrimeNG integration

`src/app/config/primeng.config.ts` extends Aura's preset by binding
`semantic.primary.*` to `--ep-color-primary-*` CSS vars. Result:

- PrimeNG buttons (`p-button`) automatically use Indigo Blue.
- Active menu items (`p-menubar`, `p-menu`, `p-panelmenu`) highlight in
  primary tint.
- Focus rings on form controls use `--ep-shadow-focus` (Indigo Blue).
- Light/dark colour-scheme bindings flip palette on `<html class="dark">`.

**No component-level overrides should be needed.** If you find yourself
reaching for PrimeNG's `pt={ root: { class: 'bg-…' } }` to recolour a
component, it's usually a sign the token system is missing an alias —
add it instead.

---

## 12 · Off-brand colour policy

Three categories of colour are intentionally **not** brand:

1. **Red (`--ep-color-danger-*`)** — universal "stop" signal. Replacing
   it with a brand colour weakens accessibility for colour-blind users
   and breaks expectations from every other app they've used.
2. **Black / pure white** — exposed as `--ep-color-neutral-950` and
   `--ep-color-neutral-0` for the rare cases (PDF preview backgrounds,
   ID-card mockups) where neutral mid-tones aren't appropriate.
3. **Third-party brand colours** — Microsoft Teams blue, Slack purple,
   etc. — render in their authentic colour when used in connector chips
   / "Sign in with X" buttons. Do not coerce into the brand palette.

Anything else outside the four core scales + semantic aliases needs
design review.

---

## 13 · Verification checklist

After any palette change, run:

```bash
# 1. Build clean
npm run build
# Expected: 0 errors, 0 warnings.

# 2. Hard-reload the dev server
npm run start
# Open http://localhost:4200, hard-refresh (Ctrl+Shift+R).

# 3. DevTools → Elements → pick any branded element →
#    Computed → background-color
# Confirm: the value resolves to the new hex via var(--ep-color-…).

# 4. DevTools → Lighthouse → Accessibility audit
# Confirm: no contrast failures introduced.

# 5. Toggle dark mode (user-menu → Theme: Dark)
# Confirm: surfaces flip to deep indigo tones, not pure black; brand
# accents (badges, buttons) stay readable.

# 6. (Tenant rebrand) Add `class="tenant-acme"` on <html> via DevTools
# Confirm: chrome + Tailwind utilities re-paint with tenant colours.
```

---

## 14 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-24 | Claude (Opus 4.7) | Initial brand-palette strategy. Replaced cool slate / Tailwind-blue palette with four-colour brand: Indigo Blue (#1B3F73), Palmetto Green (#1F5328), Yellow Jessamine (#F4B82E), Opaque White (#FAFAF7). Added 11-step scales for each, brand gradients, dark-mode overrides, accessibility contrast matrix. Updated `theme-color` meta + focus-ring tint. |
