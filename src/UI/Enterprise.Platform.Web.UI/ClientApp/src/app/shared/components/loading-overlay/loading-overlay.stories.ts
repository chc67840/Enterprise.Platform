import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { LoadingOverlayComponent } from './loading-overlay.component';

const meta: Meta<LoadingOverlayComponent> = {
  title: 'Primitives/LoadingOverlay',
  component: LoadingOverlayComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LoadingOverlayComponent] })],
};

export default meta;
type Story = StoryObj<LoadingOverlayComponent>;

/**
 * Overlay wants `position: relative` on its container. The render wraps the
 * overlay in a sample card so the component has a surface to anchor to.
 */
export const OverContent: Story = {
  args: { message: 'Loading users' },
  render: (args) => ({
    props: args,
    template: `
      <div class="relative rounded-ep-xl bg-white p-6 ring-1 ring-neutral-200" style="min-height: 240px; width: 480px;">
        <h2 class="mb-3 text-lg font-semibold text-neutral-800">Users</h2>
        <p class="text-sm text-neutral-600">Content behind the overlay stays visible and is marked aria-busy.</p>
        <app-loading-overlay [message]="message" />
      </div>
    `,
  }),
};

export const Silent: Story = {
  render: () => ({
    template: `
      <div class="relative rounded-ep-xl bg-white p-6 ring-1 ring-neutral-200" style="min-height: 240px; width: 480px;">
        <p class="text-sm text-neutral-600">No visible label — SR-only fallback reads "Loading".</p>
        <app-loading-overlay />
      </div>
    `,
  }),
};
