import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { ErrorStateComponent } from './error-state.component';

const meta: Meta<ErrorStateComponent> = {
  title: 'Primitives/ErrorState',
  component: ErrorStateComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [ErrorStateComponent] })],
};

export default meta;
type Story = StoryObj<ErrorStateComponent>;

export const Default: Story = {
  args: {
    title: "Couldn't load users",
    message: 'The server returned an unexpected error. Please try again.',
    correlationId: 'a4d8a8ae-0000-4000-8000-000000000000',
  },
};

export const WithoutCorrelation: Story = {
  args: {
    title: 'Connection lost',
    message: 'Check your internet connection and retry.',
  },
};

export const MinimalContent: Story = {
  args: {
    title: 'Something went wrong',
  },
};
