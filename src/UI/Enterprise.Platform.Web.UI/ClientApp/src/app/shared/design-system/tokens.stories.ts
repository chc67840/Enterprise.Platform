/**
 * Tokens reference — renders swatches + spacing / radius / shadow previews for
 * every `--ep-*` custom property defined in `src/styles/tokens.css`. Acts as
 * the design-system reference: paste a URL to this story into Figma specs
 * + PR reviews so values are discoverable in one place.
 */
import type { Meta, StoryObj } from '@storybook/angular';

const meta: Meta = {
  title: 'Design System/Tokens',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    a11y: {
      // Swatch grids carry contrast ratios below AA by design (they're visual
      // references, not UI). Skip colour-contrast scoring for this story.
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
};

export default meta;
type Story = StoryObj;

const palettes = ['primary', 'neutral'] as const;
const scale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const ColourPalettes: Story = {
  render: () => ({
    template: `
      <div class="space-y-6">
        ${palettes
          .map(
            (name) => `
              <section>
                <h3 class="mb-2 text-sm font-semibold text-neutral-800">${name}</h3>
                <div class="grid grid-cols-11 gap-2">
                  ${scale
                    .map(
                      (step) => `
                        <div class="flex flex-col items-center">
                          <div
                            class="h-12 w-full rounded-ep-md ring-1 ring-neutral-200"
                            style="background: var(--ep-color-${name}-${step})"
                            aria-label="${name} ${step}"
                          ></div>
                          <span class="mt-1 text-[10px] text-neutral-500">${step}</span>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>
    `,
  }),
};

const semantic = ['success', 'warning', 'danger', 'info'] as const;

export const SemanticColours: Story = {
  render: () => ({
    template: `
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${semantic
          .map(
            (name) => `
              <div class="rounded-ep-lg p-4 ring-1 ring-neutral-200"
                   style="background: var(--ep-color-${name}-bg); color: var(--ep-color-${name})">
                <p class="text-sm font-semibold capitalize">${name}</p>
                <p class="mt-1 text-xs">--ep-color-${name}</p>
              </div>
            `,
          )
          .join('')}
      </div>
    `,
  }),
};

const radiusSteps: Array<[string, string]> = [
  ['sm', '0.25rem'],
  ['md', '0.5rem'],
  ['lg', '0.75rem'],
  ['xl', '1rem'],
  ['2xl', '1.5rem'],
  ['full', '9999px'],
];

export const Radii: Story = {
  render: () => ({
    template: `
      <div class="flex flex-wrap gap-4">
        ${radiusSteps
          .map(
            ([name, v]) => `
              <div class="flex flex-col items-center">
                <div class="h-16 w-16 bg-primary-500" style="border-radius: var(--ep-radius-${name})"></div>
                <span class="mt-1 text-xs text-neutral-500">--ep-radius-${name}</span>
                <span class="text-[10px] text-neutral-400">${v}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    `,
  }),
};

const shadowSteps = ['xs', 'sm', 'md', 'lg', 'xl'];

export const Shadows: Story = {
  render: () => ({
    template: `
      <div class="grid gap-6 bg-neutral-50 p-6 md:grid-cols-5">
        ${shadowSteps
          .map(
            (step) => `
              <div class="flex flex-col items-center">
                <div class="h-20 w-20 rounded-ep-lg bg-white"
                     style="box-shadow: var(--ep-shadow-${step})"></div>
                <span class="mt-2 text-xs text-neutral-500">--ep-shadow-${step}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    `,
  }),
};

const spacingSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

export const Spacing: Story = {
  render: () => ({
    template: `
      <div class="space-y-2">
        ${spacingSteps
          .map(
            (step) => `
              <div class="flex items-center gap-3">
                <span class="w-24 text-xs text-neutral-500">--ep-space-${step}</span>
                <div class="h-3 bg-primary-400" style="width: var(--ep-space-${step})"></div>
              </div>
            `,
          )
          .join('')}
      </div>
    `,
  }),
};
