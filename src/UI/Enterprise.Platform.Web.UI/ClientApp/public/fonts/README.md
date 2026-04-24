# Self-Hosted Fonts

Drop WOFF2 files for the three brand typefaces here. Engineers don't have to
touch any build config — `src/styles/fonts.css` already declares the
`@font-face` blocks; uncomment the matching block once the file lands.

> **Authoritative spec:** [`Docs/Architecture/UI-Typography-Strategy.md`](../../../../../../Docs/Architecture/UI-Typography-Strategy.md)

## Required directory layout

```
public/fonts/
├── noto-sans/                          (optional — Google Fonts CDN by default)
│   ├── noto-sans-latin-variable.woff2
│   └── noto-sans-latin-italic-variable.woff2
├── arno-pro/                           (commercial — Adobe Fonts)
│   ├── arno-pro-400.woff2              (Regular)
│   ├── arno-pro-400-italic.woff2       (Italic)
│   ├── arno-pro-600.woff2              (Semibold)
│   ├── arno-pro-600-italic.woff2       (Semibold Italic)
│   ├── arno-pro-700.woff2              (Bold)
│   └── arno-pro-700-italic.woff2       (Bold Italic)
└── bicycletter/                        (commercial / custom display)
    ├── bicycletter-700.woff2           (Bold)
    └── bicycletter-900.woff2           (Black)
```

## After dropping files

1. Open `src/styles/fonts.css`.
2. Uncomment the matching `@font-face` block(s).
3. `npm run build` — confirm the CSS bundle size grew by the expected
   amount (each WOFF2 is referenced lazily so only the files used render
   are downloaded; check Network tab in DevTools).
4. Hard-reload the app. Inspect any element using the family in DevTools
   → Computed → Rendered Fonts to verify the licensed face is in use
   (not a fallback).

## Licensing

| Family | Licence | How to obtain |
|---|---|---|
| Noto Sans | SIL OFL 1.1 (free) | https://fonts.google.com/noto/specimen/Noto+Sans |
| Arno Pro | Adobe Fonts (commercial) | Adobe Creative Cloud kit *or* perpetual desktop + web addendum |
| Bicycletter | Custom (commercial) | Foundry-issued web licence required |

**Do not commit unlicensed font files.** WOFF2 files are not protected
artefacts — they're as redistributable as the licence allows. Reach out
to legal/procurement if you're unsure whether your kit covers
self-hosting on this app's domain.

## CSP impact

Self-hosted fonts are served from `'self'` — no CSP relaxation needed.
After all three families are self-hosted you can tighten the BFF CSP
(see `Enterprise.Platform.Web.UI/Middleware/SecurityHeadersMiddleware.cs`)
by removing `https://fonts.googleapis.com` from `style-src` and
`https://fonts.gstatic.com` from `font-src`.
