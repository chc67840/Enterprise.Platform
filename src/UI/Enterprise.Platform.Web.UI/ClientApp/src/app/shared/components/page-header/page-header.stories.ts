import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { PageHeaderComponent, type Breadcrumb } from './page-header.component';

const meta: Meta<PageHeaderComponent> = {
  title: 'Primitives/PageHeader',
  component: PageHeaderComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [PageHeaderComponent] })],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<PageHeaderComponent>;

const crumbs: readonly Breadcrumb[] = [
  { label: 'Home', url: '/' },
  { label: 'Users' },
];

export const Default: Story = {
  args: {
    title: 'Users',
    subtitle: 'Manage platform users and their roles.',
    breadcrumbs: crumbs,
  },
};

export const WithAction: Story = {
  args: {
    title: 'Users',
    subtitle: 'Manage platform users and their roles.',
    breadcrumbs: crumbs,
  },
  render: (args) => ({
    props: args,
    template: `
      <app-page-header [title]="title" [subtitle]="subtitle" [breadcrumbs]="breadcrumbs">
        <button class="rounded-ep-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">
          New user
        </button>
      </app-page-header>
    `,
  }),
};

export const NoBreadcrumbs: Story = {
  args: {
    title: 'Dashboard',
    subtitle: 'Welcome back.',
    breadcrumbs: [],
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'Settings',
    breadcrumbs: [],
  },
};
