# UI Typography Strategy

**Scope:** every typeface, weight, fallback, and font-loading decision used
by the Angular SPA. How the system is wired, where to change a single
family, where to change a weight remap, where to license a new face, and
how the fallback chain protects the app when a licensed file is missing.

**Audience:**
- **Designers** — the three-role system + when to use which face.
- **Engineers** — every file that touches a font, with the exact line to
  change.
- **DevOps / DPO** — CSP impact, third-party-CDN tradeoff, GDPR posture.

**Companion docs:**
- [`UI-Architecture.md`](./UI-Architecture.md) — overall SPA architecture
- [`UI-Styling-Strategy.md`](./UI-Styling-Strategy.md) — PrimeNG + Tailwind tokens
- [`UI-Config-Files-Reference.md`](./UI-Config-Files-Reference.md) — every config file

---

## 1 · TL;DR

The SPA uses three typefaces, each with a clearly bounded role:

| Role | Default family | Use for | Fallback chain |
|---|---|---|---|
| **Primary** | **Noto Sans** | Body text, UI controls, navigation, tables, forms — every screen affordance | system-ui → -apple-system → Segoe UI → Roboto → Helvetica Neue → Arial → sans-serif |
| **Secondary** | **Arno Pro** | Editorial: long-form headlines, subheads, article body | Georgia → Cambria → Times New Roman → Times → serif |
| **Accent** | **Bicycletter** | Display-only: hero titles, CTAs, callouts, pull-quotes | Arial Black → Helvetica Black → Impact → system-ui → sans-serif |
| Mono | JetBrains Mono | Code, IDs, technical labels | Fira Code → Menlo → Consolas → Courier New → monospace |

Five weight tokens — `regular (400)`, `medium (500)`, `semibold (600)`,
`bold (700)`, `black (900)`.

Loading: **Noto Sans** comes from Google Fonts (free; CDN). **Arno Pro**
and **Bicycletter** are commercial — drop WOFF2 files into
`ClientApp/public/fonts/` and uncomment the matching `@font-face` in
`src/styles/_typography.scss`. Until then, the fallbacks above carry the role
correctly.

---

## 2 · The three-role system

### 2.1 Why three roles instead of "one font"

A single typeface can do everything but does no single thing
*especially well*. Splitting the responsibilities lets each face
specialise:

- **Primary** is optimised for screen reading at small sizes (12–18 px).
  The default — Noto Sans — was designed by Google + Adobe specifically
  for low-DPI legibility across **800+ scripts**. Latin, Cyrillic, and
  Greek alphabets render with consistent metrics, which matters for any
  app that may show user-generated names or addresses in mixed scripts
  (Cyrillic patient names alongside a Greek-language report, etc.).
- **Secondary** carries editorial weight where the primary face would
  feel too utilitarian. Arno Pro is Adobe's flagship serif — the long
  ascenders/descenders give it presence at headline sizes without
  shouting.
- **Accent** is intentionally limited to two cuts (Bold, Black). Display
  faces are tonally heavy; using one for body text is fatigue-inducing.
  Reserve it for the moments that *should* feel loud — the hero
  headline, a single CTA, a pull-quote.

### 2.2 When to use which

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hero headline                                                      │  ← accent (Bicycletter Black)
│  ──────────────────────────────────                                 │
│  Section title                                                      │  ← secondary (Arno Pro Bold)
│                                                                     │
│  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do    │  ← primary (Noto Sans Regular)
│  eiusmod tempor incididunt ut labore et dolore magna aliqua.        │
│                                                                     │
│  ┌────────────────┐                                                 │
│  │  Get started   │                                                 │  ← accent (Bicycletter Bold)
│  └────────────────┘                                                 │
│                                                                     │
│  > Long-form callout quote in editorial voice                       │  ← secondary (Arno Pro Italic)
│                                                                     │
│  api/v1/users/{id}                                                  │  ← mono (JetBrains Mono)
└─────────────────────────────────────────────────────────────────────┘
```

| Surface | Use |
|---|---|
| Body copy, paragraphs, lists | **Primary** |
| Form labels, inputs, buttons | **Primary** |
| Navigation, menus, breadcrumbs | **Primary** |
| Table rows, captions | **Primary** |
| Page titles (`<h1>`–`<h2>`) in feature pages | **Primary semibold/bold** |
| Editorial headlines (marketing, articles) | **Secondary bold** |
| Long-form article body | **Secondary regular** |
| Pull-quotes | **Secondary italic** |
| Hero / landing-page titles | **Accent black** |
| Primary CTAs ("Get started", "Sign up") | **Accent bold** |
| Callouts, badges, ribbons | **Accent bold** |
| Code blocks, IDs, file paths, JSON | **Mono** |

### 2.3 What NOT to mix

- Never use **Accent** for body text.
- Never use **Mono** for headings (it's tonal noise at large sizes).
- Avoid stacking three faces in the same component. Two is the max
  before the eye starts to perceive "design noise".

---

## 3 · Token system

Every typography decision is a CSS custom property in
`src/styles/_tokens.scss`. The component layer references the token, never
the literal family/weight string.

### 3.1 Family tokens

```css
--ep-font-primary:   'Noto Sans', system-ui, …, sans-serif;
--ep-font-secondary: 'Arno Pro', Georgia, Cambria, …, serif;
--ep-font-accent:    'Bicycletter', 'Arial Black', 'Helvetica Black', …;
--ep-font-mono:      'JetBrains Mono', 'Fira Code', Menlo, …, monospace;

/* Back-compat alias — `--ep-font-sans` continues to map to primary */
--ep-font-sans: var(--ep-font-primary);
```

### 3.2 Weight tokens

```css
--ep-font-weight-regular:   400;
--ep-font-weight-medium:    500;
--ep-font-weight-semibold:  600;
--ep-font-weight-bold:      700;
--ep-font-weight-black:     900;
```

### 3.3 Size + leading tokens (unchanged)

```css
--ep-text-xs:   0.75rem;   /* 12px */
--ep-text-sm:   0.875rem;  /* 14px */
--ep-text-base: 1rem;      /* 16px */
--ep-text-lg:   1.125rem;
--ep-text-xl:   1.25rem;
--ep-text-2xl:  1.5rem;
--ep-text-3xl:  1.875rem;
--ep-leading-tight:   1.25;
--ep-leading-normal:  1.5;
--ep-leading-relaxed: 1.75;
```

### 3.4 How tokens reach the screen

```
  styles/_tokens.scss   styles/_typography.scss   index.html (Noto Sans link)
        │                   │                       │
        └── styles/styles.scss (@use) ──┘            │
              ▲                                     │
              │  styles/tailwind.css                 │
              │                                     │
              │  @theme inline {                    │
              │    --font-primary: var(--ep-font-primary);
              │    --font-secondary: var(--ep-font-secondary);
              │    --font-accent: var(--ep-font-accent);
              │    --font-sans: var(--ep-font-primary);   /* alias */
              │    --font-serif: var(--ep-font-secondary);
              │    --font-mono: var(--ep-font-mono);
              │  }
              │
              ▼
       Tailwind utilities
       ─────────────────
       class="font-primary"   → font-family: 'Noto Sans', …
       class="font-secondary" → font-family: 'Arno Pro', …
       class="font-accent"    → font-family: 'Bicycletter', …
       class="font-bold"      → font-weight: 700
       class="font-semibold"  → font-weight: 600
```

PrimeNG components inherit from `<body>` (which sets `font-family:
var(--ep-font-primary)`), so the menubar, drawer, dialogs, and form
controls all pick up the primary face automatically — no per-component
overrides needed.

---

## 4 · The five files involved

When the brand changes, **these are the only files you touch.** Every
other file just consumes the tokens.

| # | File | What it owns |
|---|---|---|
| 1 | `src/styles/_tokens.scss` | Family + weight + size tokens |
| 2 | `src/styles/_typography.scss` | `@font-face` declarations for self-hosted faces |
| 3 | `src/styles/tailwind.css` | Bridges tokens to Tailwind utilities (`@theme inline`) |
| 4 | `src/index.html` | Loads remote (CDN) font CSS |
| 5 | `Enterprise.Platform.Web.UI/Middleware/SecurityHeadersMiddleware.cs` | CSP `style-src` / `font-src` directives |

---

## 5 · How-to recipes

### 5.1 Change the primary family from Noto Sans to a different sans-serif

1. Open `src/styles/_tokens.scss`.
2. Edit one line:
   ```css
   --ep-font-primary: 'Inter', system-ui, …, sans-serif;
   ```
3. Open `src/index.html`, swap the Google Fonts URL:
   ```html
   <link rel="stylesheet"
     href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" />
   ```
4. `npm run build`. Done. Body, headings, PrimeNG components, every
   `font-primary` / `font-sans` Tailwind utility re-renders in Inter on
   the next paint.

### 5.2 Change a single weight remap (e.g. "bold" should render heavier)

1. Open `src/styles/_tokens.scss`.
2. Edit one line:
   ```css
   --ep-font-weight-bold: 800;   /* was 700 */
   ```
3. Done. Every `font-bold` utility, every `font-weight: var(--ep-font-weight-bold)`
   reference, and PrimeNG components that use that variable shift weight.

### 5.3 Add a new substitute typeface to a fallback chain

1. Open `src/styles/_tokens.scss`.
2. Insert into the appropriate `--ep-font-*` value:
   ```css
   --ep-font-secondary: 'Arno Pro', 'Spectral', Georgia, …, serif;
   ```
3. Done. `Spectral` will be used if Arno Pro is unavailable but Spectral
   is installed locally.

### 5.4 Self-host a Google-hosted face (move Noto Sans off the CDN)

1. Download Noto Sans WOFF2 files (variable-axis preferred — one file
   covers all weights). Drop them into
   `ClientApp/public/fonts/noto-sans/`.
2. Open `src/styles/_typography.scss` and uncomment the **Noto Sans** `@font-face`
   blocks at the top.
3. Open `src/index.html` and **delete** the three `<link>` tags for Google
   Fonts (preconnect + stylesheet).
4. Open
   `Enterprise.Platform.Web.UI/Middleware/SecurityHeadersMiddleware.cs`
   and remove `https://fonts.googleapis.com` from `style-src` and
   `https://fonts.gstatic.com` from `font-src`. Tighter CSP.
5. `npm run build`. The Network tab now shows the WOFF2s coming from
   `'self'`. CSP audit passes the strictest rule (`default-src 'self'`
   would now also be valid for fonts).

### 5.5 License + add Arno Pro

1. Procure a web licence (Adobe Fonts kit OR perpetual + web addendum).
2. Export the six cuts as WOFF2 (Regular, Italic, Semibold, Semibold
   Italic, Bold, Bold Italic).
3. Drop into `ClientApp/public/fonts/arno-pro/` with the names
   documented in `public/fonts/README.md`.
4. Open `src/styles/_typography.scss` and uncomment the **Arno Pro** `@font-face`
   blocks.
5. `npm run build`. Hard-reload. Inspect any element using
   `class="font-secondary font-bold"` — DevTools → Computed → "Rendered
   Font" should report **Arno Pro Bold**, not Georgia.

### 5.6 License + add Bicycletter

Same as Arno Pro, two cuts (Bold 700, Black 900). Drop files into
`public/fonts/bicycletter/` and uncomment the relevant block in
`_typography.scss`.

### 5.7 Tenant-specific brand override

For multi-tenant deployments, declare a tenant-class scope that
re-binds the family tokens. Tailwind utilities + PrimeNG components
follow automatically.

```css
/* In a tenant overlay stylesheet, loaded after styles.scss + tailwind.css */
.tenant-acme {
  --ep-font-primary:   'Acme Grotesk', system-ui, …;
  --ep-font-secondary: 'Acme Display', Georgia, …;
  --ep-font-accent:    'Acme Slab', 'Arial Black', …;
}
```

The shell sets `class="tenant-acme"` on `<html>` based on
`TenantService`. Body + chrome flips face on the next paint. No JS
required.

---

## 6 · Loading strategy

### 6.1 Noto Sans — Google Fonts (default)

Loaded via `<link>` in `src/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,500;1,600;1,700&display=swap" />
```

**Why this URL works:**

- **`ital,wght@…`** axes — requests roman + italic at five weights each.
  Google Fonts returns variable-axis WOFF2 so this is one file per
  subset, not 10.
- **`display=swap`** — text paints in the system fallback **immediately**;
  re-paints in Noto Sans when ready. No FOIT (Flash of Invisible Text).
- **`unicode-range`** — Google Fonts emits one `@font-face` per script
  subset (Latin / Latin-ext / Cyrillic / Cyrillic-ext / Greek /
  Greek-ext / Vietnamese). The browser only downloads subsets that
  actually appear on the page. A page with only Latin characters
  downloads ~25 KB; a page mixing Latin + Cyrillic downloads ~50 KB.
- **`preconnect`** — saves ~150 ms of TLS handshake time before the CSS
  fetch fires.

### 6.2 Arno Pro / Bicycletter — self-hosted (when licensed)

Declared in `src/styles/_typography.scss`. `font-display: swap` + `local()`
optimisation:

```css
@font-face {
  font-family: 'Arno Pro';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: local('ArnoPro-Regular'),
       url('/fonts/arno-pro/arno-pro-400.woff2') format('woff2');
}
```

- **`local('ArnoPro-Regular')`** first — if the user has the desktop
  font installed (common for Adobe-subscriber designers reviewing the
  app), the browser uses the OS copy and skips the network entirely.
- **WOFF2 only** — modern, smallest format (~30 % smaller than WOFF).
  Every supported browser (Chrome, Edge, Firefox, Safari ≥ 12) has
  native WOFF2 support. Legacy WOFF / TTF fallbacks are no longer
  worth the bytes.
- **`font-display: swap`** — same FOUT-over-FOIT decision as Google
  Fonts.

### 6.3 Why two strategies (CDN + self-hosted) coexist

| Aspect | Google Fonts CDN | Self-hosted |
|---|---|---|
| Setup cost | Zero (one `<link>`) | Drop files + `@font-face` |
| First-paint latency | Cold-cache: 1 round-trip extra. Warm: free (huge cross-site cache). | Always served from `'self'`. |
| CSP impact | Requires `fonts.googleapis.com` + `fonts.gstatic.com` allowlist | None (`'self'` covers it) |
| Privacy | Google sees one IP per visitor (no cookies) | Zero third-party traffic |
| Offline / PWA | Fails | Works |
| Multi-script subsets | Auto via `unicode-range` (free win) | Have to ship all subsets up front |

For Noto Sans (free, 10+ scripts) the CDN tradeoff favours the CDN.
For commercial faces (Arno Pro / Bicycletter) self-hosting is the only
option — Adobe Fonts and most foundries prohibit redistribution via
arbitrary CDNs.

If a regulated tenant must operate without third-party traffic
(stricter HIPAA / GDPR posture), self-host Noto Sans too — see §5.4.

---

## 7 · CSP impact

The BFF emits Content-Security-Policy headers from
`Enterprise.Platform.Web.UI/Middleware/SecurityHeadersMiddleware.cs`.
Today's typography setup requires two relaxations vs the baseline:

```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src  'self' data:           https://fonts.gstatic.com
```

These are **specific** allowlists — not blanket `https:` — which keeps the
attack surface narrow. A malicious script could not load fonts from any
arbitrary origin; only Google's font CDN.

When the team self-hosts Noto Sans (per §5.4), both entries can be
removed — tightest CSP achievable without disabling fonts entirely.

---

## 8 · Accessibility & legibility

### 8.1 Multi-script support

Noto Sans is the only typeface in the brief that **must** carry Latin,
Cyrillic, and Greek with consistent metrics. The Google Fonts link in
`index.html` requests every weight needed; subset downloading is
automatic via `unicode-range`.

If a feature must render names in scripts the primary face does NOT
cover (Arabic, CJK, Devanagari, etc.), use a per-element override:

```html
<span class="font-[Noto_Sans_Arabic]" lang="ar">العربية</span>
```

The corresponding script-specific Noto family must be added to the
Google Fonts URL in `index.html` first.

### 8.2 Font-display: swap and CLS

`font-display: swap` causes a brief layout shift when the web font
finishes loading (the system fallback may have different metrics). To
keep Cumulative Layout Shift under control:

- All three families have **size-matched fallbacks** — Noto Sans → system-ui
  (close metrics), Arno Pro → Georgia (very close metrics), Bicycletter →
  Arial Black (close metrics). The shift is visually small.
- Bigger improvement available: add `size-adjust`, `ascent-override`,
  and `descent-override` to the `@font-face` blocks. Not done yet —
  tracked as an optimisation for when a real Lighthouse CLS budget is
  defined.

### 8.3 Minimum body size

`--ep-text-base: 1rem` (= 16 px). WCAG AA recommends ≥ 14 px for body
copy; we exceed it. Don't override component body text below
`text-sm` (14 px) without an a11y review.

---

## 9 · Performance budgets

| Asset | Cold cache | Warm cache | Notes |
|---|---|---|---|
| Google Fonts CSS file | ~3 KB gzipped | 0 (24 h cache) | One file regardless of weight count |
| Noto Sans Latin variable WOFF2 | ~25 KB | 0 (1 yr cache) | Loaded only if Latin chars on page |
| Noto Sans Cyrillic variable WOFF2 | ~30 KB | 0 | Loaded only if Cyrillic chars on page |
| Arno Pro Regular WOFF2 (when self-hosted) | ~45 KB | 0 | Per cut |
| Bicycletter Bold WOFF2 (when self-hosted) | ~25 KB | 0 | Display fonts are smaller |

**Total typography cost on cold cache (Latin only):**
- Today (Noto Sans only): **~28 KB**
- After all three families self-hosted, Latin only: **~210 KB**

Acceptable. Initial bundle budget in `angular.json` is 1 MB warning;
typography stays well under.

---

## 10 · Verification checklist

After any typography change, run:

```bash
# 1. Build clean
npm run build

# 2. Hard-reload the dev server
npm run start
# Open http://localhost:4200, hard-refresh (Ctrl+Shift+R)

# 3. DevTools → Network → filter "Font"
# Confirm: the expected WOFF2 files load with HTTP 200, NOT 404.

# 4. DevTools → pick any text element → Computed → "Rendered Font"
# Confirm: the licensed face is named, not a fallback.

# 5. DevTools → Console
# Confirm: no CSP violations (`Refused to load font from …`).
```

---

## 11 · Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-24 | Claude (Opus 4.7) | Initial typography strategy. Added primary/secondary/accent token system. Loaded Noto Sans via Google Fonts; placeholders for Arno Pro + Bicycletter pending licensing. Updated BFF CSP to allowlist `fonts.googleapis.com` + `fonts.gstatic.com`. |
