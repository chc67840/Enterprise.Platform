/**
 * ─── PRIMENG CONFIGURATION ──────────────────────────────────────────────────────
 *
 * WHY
 *   PrimeNG 21 moved to a "preset" theme system — one configuration object
 *   controls colours, dark-mode selector, CSS layer order, z-index scale,
 *   and default input variants. Pinning it here (rather than letting
 *   components override ad-hoc) keeps visual consistency across features.
 *
 * KEY DECISIONS
 *   - **Aura preset, blue primary** — Aura is PrimeNG's flagship theme; we
 *     extend it via `definePreset(...)` so the primary palette tracks our
 *     `--ep-color-primary-*` tokens. Single source of truth for brand colour:
 *     change `_tokens.scss` and BOTH Tailwind utilities and PrimeNG components
 *     (buttons, focus rings, active menu items, badges) flip together.
 *   - **`.dark` selector** — matches our `ThemeService` toggle; one DOM
 *     hook for every themed element.
 *   - **CSS layer order**: `theme, base, primeng, utilities`. These are the
 *     ACTUAL Tailwind v4 layer names — not the example `tailwind-base /
 *     tailwind-utilities` from PrimeNG docs which only work if you split-import
 *     Tailwind into renamed layers. With our standard `@import 'tailwindcss'`
 *     setup, listing non-existent layer names leaves the cascade undefined and
 *     PrimeNG components render unstyled because preflight wins.
 *   - **Outlined inputs** — the most neutral variant; individual fields may
 *     override to `filled` where density matters.
 *
 * HOW IT'S USED
 *   `app.config.ts` registers this via `providePrimeNG(primeNgConfig)`.
 *   Nothing else should touch `primeng/config` — call sites that need a
 *   different theme at runtime call `updatePrimaryPalette(...)` from
 *   `@primeuix/themes` instead.
 *
 * WHY @primeuix/themes (not @primeng/themes)
 *   `@primeng/themes` was the legacy Angular-flavoured wrapper around the
 *   underlying theme engine. As of v21 it is officially DEPRECATED on npm
 *   ("Please migrate to @primeuix/themes"). The two packages export an
 *   identical API surface — `@primeng/themes` was a thin re-export — so
 *   the migration is a pure import swap with no runtime change.
 *   See Docs/Architecture/UI-PrimeUix-Migration.md for the full rationale.
 */
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import type { PrimeNGConfigType } from 'primeng/config';

/**
 * Brand-tinted Aura preset.
 *
 * `primary.*` is bound to our `--ep-color-primary-*` tokens (blue palette
 * in `_tokens.scss`). PrimeNG resolves these to the live CSS-var values, so
 * any future per-tenant re-brand only needs to swap the token values — no
 * theme rebuild, no component updates.
 *
 * `colorScheme.{light,dark}.primary` controls how the primary swatch maps
 * to text/background pairs. We accept Aura's defaults for everything else
 * (surfaces, focus rings, severity colours) since they already contrast
 * well against a blue primary.
 */
const EnterpriseAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: 'var(--ep-color-primary-50)',
      100: 'var(--ep-color-primary-100)',
      200: 'var(--ep-color-primary-200)',
      300: 'var(--ep-color-primary-300)',
      400: 'var(--ep-color-primary-400)',
      500: 'var(--ep-color-primary-500)',
      600: 'var(--ep-color-primary-600)',
      700: 'var(--ep-color-primary-700)',
      800: 'var(--ep-color-primary-800)',
      900: 'var(--ep-color-primary-900)',
      950: 'var(--ep-color-primary-950)',
    },
    colorScheme: {
      light: {
        primary: {
          color: 'var(--ep-color-primary-600)',
          contrastColor: '#ffffff',
          hoverColor: 'var(--ep-color-primary-700)',
          activeColor: 'var(--ep-color-primary-800)',
        },
        highlight: {
          background: 'var(--ep-color-primary-50)',
          focusBackground: 'var(--ep-color-primary-100)',
          color: 'var(--ep-color-primary-700)',
          focusColor: 'var(--ep-color-primary-800)',
        },
      },
      dark: {
        primary: {
          color: 'var(--ep-color-primary-400)',
          contrastColor: 'var(--ep-color-neutral-950)',
          hoverColor: 'var(--ep-color-primary-300)',
          activeColor: 'var(--ep-color-primary-200)',
        },
        highlight: {
          background: 'color-mix(in srgb, var(--ep-color-primary-400), transparent 84%)',
          focusBackground: 'color-mix(in srgb, var(--ep-color-primary-400), transparent 76%)',
          color: 'var(--ep-color-primary-200)',
          focusColor: 'var(--ep-color-primary-100)',
        },
      },
    },
  },
});

export const primeNgConfig: PrimeNGConfigType = {
  theme: {
    preset: EnterpriseAura,
    options: {
      /** Dark mode activates when `<html>` carries the `.dark` class. */
      darkModeSelector: '.dark',
      /**
       * CSS layer order — Tailwind v4 default layer names. See block comment
       * at the top of this file for why these (not `tailwind-base /
       * tailwind-utilities`) are correct.
       */
      cssLayer: {
        name: 'primeng',
        order: 'theme, base, primeng, utilities',
      },
    },
  },
  ripple: true,
  inputStyle: 'outlined',
  /**
   * Z-index scale — ensures modals/dialogs sit above menus/tooltips.
   * PrimeNG defaults are sometimes too low for complex nested UIs.
   */
  zIndex: {
    modal: 1100,
    overlay: 1000,
    menu: 1000,
    tooltip: 1100,
  },
};
