/**
 * ─── STORYBOOK MAIN CONFIG ──────────────────────────────────────────────────────
 *
 * Storybook 10 + @storybook/angular. Ships with the official Angular
 * framework builder — uses Angular's native build pipeline under the hood so
 * component compilation matches production (strict templates, signals, etc.).
 *
 * SCOPE
 *   - Stories live under `src/app/**` alongside the components they cover.
 *   - Global tokens + animations are imported via the preview so every story
 *     renders with the real CSS surface (including Tailwind + PrimeNG theme).
 *   - The a11y addon runs axe-core checks against every rendered story; the
 *     test-runner (Phase 5.1.5) turns those checks into a CI gate.
 *
 * WEBPACK POSTCSS CHAIN
 *   Storybook's angular-cli preset uses webpack 5; our production build uses
 *   `@angular/build` (esbuild) which handles PostCSS natively. Storybook's
 *   webpack CSS loader chain doesn't include postcss-loader by default, so
 *   Tailwind v4's `@import 'tailwindcss'` trips "Unexpected character '@'".
 *   The `webpackFinal` hook below inserts `postcss-loader` at the end of each
 *   CSS rule so Tailwind + `@theme inline` are processed before css-loader.
 */
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular',
    options: {},
  },

  stories: [
    '../src/app/**/*.stories.@(ts|mdx)',
    '../src/app/**/*.story.@(ts|mdx)',
  ],

  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],

  staticDirs: ['../public'],

  core: {
    disableTelemetry: true,
  },

  webpackFinal: async (cfg) => {
    const rules = cfg.module?.rules ?? [];
    for (const rule of rules) {
      if (
        rule &&
        typeof rule === 'object' &&
        'test' in rule &&
        rule.test instanceof RegExp &&
        rule.test.test('test.css') &&
        Array.isArray(rule.use)
      ) {
        rule.use.push({
          loader: 'postcss-loader',
          options: {
            postcssOptions: { config: true },
          },
        });
      }
    }
    return cfg;
  },
};

export default config;
