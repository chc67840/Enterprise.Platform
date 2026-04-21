import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { EmptyStateComponent } from './empty-state.component';

const meta: Meta<EmptyStateComponent> = {
  title: 'Primitives/EmptyState',
  component: EmptyStateComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [EmptyStateComponent] })],
};

export default meta;
type Story = StoryObj<EmptyStateComponent>;

export const NoData: Story = {
  args: {
    icon: 'pi-inbox',
    title: 'No users yet',
    message: 'Create your first user to get started.',
  },
};

export const NoSearchResults: Story = {
  args: {
    icon: 'pi-search',
    title: 'No matches found',
    message: 'Try adjusting your search or filters.',
  },
};

export const WithCta: Story = {
  args: {
    icon: 'pi-inbox',
    title: 'No users yet',
    message: 'Create your first user to get started.',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-empty-state [icon]="icon" [title]="title" [message]="message">
        <button class="rounded-ep-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">
          New user
        </button>
      </app-empty-state>
    `,
  }),
};

export const WithoutIcon: Story = {
  args: {
    title: 'Nothing here',
  },
};
