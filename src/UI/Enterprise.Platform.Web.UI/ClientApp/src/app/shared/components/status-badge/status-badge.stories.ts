/**
 * StatusBadge stories — one per variant + a "kitchen sink" combination grid.
 * Serves as the canonical reference for which colour maps to which concept.
 */
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { StatusBadgeComponent } from './status-badge.component';

const meta: Meta<StatusBadgeComponent> = {
  title: 'Primitives/StatusBadge',
  component: StatusBadgeComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [StatusBadgeComponent] })],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'danger', 'info', 'neutral'],
    },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<StatusBadgeComponent>;

export const Success: Story = {
  args: { label: 'Active', variant: 'success' },
};

export const Warning: Story = {
  args: { label: 'Pending', variant: 'warning' },
};

export const Danger: Story = {
  args: { label: 'Failed', variant: 'danger' },
};

export const Info: Story = {
  args: { label: 'Draft', variant: 'info' },
};

export const Neutral: Story = {
  args: { label: 'Archived', variant: 'neutral' },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="flex flex-wrap items-center gap-2">
        <app-status-badge label="Active" variant="success" />
        <app-status-badge label="Pending" variant="warning" />
        <app-status-badge label="Failed" variant="danger" />
        <app-status-badge label="Draft" variant="info" />
        <app-status-badge label="Archived" variant="neutral" />
      </div>
    `,
  }),
};
