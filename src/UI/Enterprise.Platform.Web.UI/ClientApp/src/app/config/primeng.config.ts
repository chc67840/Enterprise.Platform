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
 *   - **Aura preset** — PrimeNG's flagship theme; modern look, sensible
 *     defaults, first-class dark-mode support.
 *   - **`.dark` selector** — matches our `ThemeService` toggle; one DOM
 *     hook for every themed element.
 *   - **CSS layer order**: `tailwind-base, primeng, tailwind-utilities`.
 *     Tailwind utilities can override PrimeNG components without `!important`.
 *   - **Outlined inputs** — the most neutral variant; individual fields may
 *     override to `filled` where density matters.
 *
 * HOW IT'S USED
 *   `app.config.ts` registers this via `providePrimeNG(primeNgConfig)`.
 *   Nothing else should touch `primeng/config` — call sites that need a
 *   different theme at runtime call `PrimeNG.theme.mutate(...)` instead.
 */
import Aura from '@primeng/themes/aura';
import type { PrimeNGConfigType } from 'primeng/config';

export const primeNgConfig: PrimeNGConfigType = {
  theme: {
    preset: Aura,
    options: {
      /** Dark mode activates when `<html>` carries the `.dark` class. */
      darkModeSelector: '.dark',
      /**
       * CSS layer order determines specificity tiebreaks. Tailwind base must
       * load before PrimeNG so component styles can reset; Tailwind utilities
       * load after so they can override individual properties.
       */
      cssLayer: {
        name: 'primeng',
        order: 'tailwind-base, primeng, tailwind-utilities',
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
