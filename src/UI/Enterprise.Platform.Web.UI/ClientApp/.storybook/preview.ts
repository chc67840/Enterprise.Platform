/**
 * ─── STORYBOOK PREVIEW CONFIG ───────────────────────────────────────────────────
 *
 * - Imports the global styles entry so every story renders with the real
 *   token + Tailwind + animation CSS.
 * - Declares responsive viewports matching the architecture's matrix
 *   (xs / sm / md / lg / xl / 2xl).
 * - Sets the a11y-addon default to `error` so the test-runner fails on any
 *   axe-reported violation (can be relaxed per-story via `parameters.a11y`).
 * - Globals: theme toggle (light / dark) + text direction (ltr / rtl) so a
 *   reviewer can flip them from the toolbar while browsing.
 */
import type { Preview } from '@storybook/angular';

// Compodoc integration is deferred — when we need auto-generated docs from
// TS types, add `@compodoc/compodoc` + a preview-level `setCompodocJson` call.

/*
 * Storybook's webpack CSS pipeline under @storybook/angular doesn't process
 * `@import 'tailwindcss'` / `@theme inline` without extensive webpack
 * customisation. Instead we inject the token custom properties directly as
 * a <link> to the static-served tokens.css, which only has `:root { ... }`
 * declarations (no `@import` / PostCSS at-rules). Primitives that rely on
 * Tailwind utility classes render with tokens fidelity but without utility
 * shorthand — a known Phase-5 limitation (see TODO 5.7.* deferred items).
 */
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/tokens.css';
  document.head.appendChild(link);
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Treat violations as errors so `npm run storybook:test` fails CI.
      test: 'error',
      config: {
        rules: [
          // Skip the `region` rule — atomic stories rarely have landmarks.
          { id: 'region', enabled: false },
        ],
      },
    },
    viewport: {
      viewports: {
        xs: { name: 'xs (360px)', styles: { width: '360px', height: '640px' } },
        sm: { name: 'sm (640px)', styles: { width: '640px', height: '800px' } },
        md: { name: 'md (768px)', styles: { width: '768px', height: '900px' } },
        lg: { name: 'lg (1024px)', styles: { width: '1024px', height: '900px' } },
        xl: { name: 'xl (1280px)', styles: { width: '1280px', height: '900px' } },
        '2xl': { name: '2xl (1536px)', styles: { width: '1536px', height: '900px' } },
      },
    },
    backgrounds: {
      default: 'page',
      values: [
        { name: 'page', value: '#ffffff' },
        { name: 'subtle', value: '#f8fafc' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },

  globalTypes: {
    theme: {
      description: 'EP theme — light / dark',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      description: 'Text direction',
      defaultValue: 'ltr',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (storyFn, context) => {
      // Theme + direction globals manipulate the <html> attributes so our
      // token overrides (`:root.dark`) + any Tailwind `dir:rtl` utilities
      // activate without per-story plumbing.
      const theme = context.globals['theme'] as string;
      const dir = context.globals['direction'] as string;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.setAttribute('dir', dir);
      }
      return storyFn();
    },
  ],

  tags: ['autodocs'],
};

export default preview;
