import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { SkeletonCardComponent } from './skeleton-card.component';

const meta: Meta<SkeletonCardComponent> = {
  title: 'Primitives/SkeletonCard',
  component: SkeletonCardComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [SkeletonCardComponent] })],
  argTypes: {
    variant: {
      control: 'select',
      options: ['card', 'list-row', 'table-row', 'chart', 'stat-card'],
    },
  },
};

export default meta;
type Story = StoryObj<SkeletonCardComponent>;

export const Card: Story = { args: { variant: 'card' } };
export const ListRow: Story = { args: { variant: 'list-row' } };
export const TableRow: Story = { args: { variant: 'table-row' } };
export const Chart: Story = { args: { variant: 'chart' } };
export const StatCard: Story = { args: { variant: 'stat-card' } };

export const ListOfRows: Story = {
  render: () => ({
    template: `
      <div class="w-[480px]">
        <app-skeleton-card variant="list-row" />
        <app-skeleton-card variant="list-row" />
        <app-skeleton-card variant="list-row" />
        <app-skeleton-card variant="list-row" />
      </div>
    `,
  }),
};
