import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { GlobalProgressBarComponent } from './global-progress-bar.component';
import { LoadingService } from '@core/services/loading.service';

/**
 * Stub LoadingService that lets each story force `isLoading()` on or off
 * without wiring HTTP interceptors.
 */
class StubLoadingService {
  private count = 0;
  inc(): void {
    this.count++;
  }
  dec(): void {
    this.count = Math.max(0, this.count - 1);
  }
  readonly isLoading = () => this.count > 0;
  readonly inFlight = () => this.count;
}

const meta: Meta<GlobalProgressBarComponent> = {
  title: 'Primitives/GlobalProgressBar',
  component: GlobalProgressBarComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [GlobalProgressBarComponent],
      providers: [{ provide: LoadingService, useClass: StubLoadingService }],
    }),
  ],
};

export default meta;
type Story = StoryObj<GlobalProgressBarComponent>;

export const Visible: Story = {
  render: () => ({
    template: `
      <p class="mb-2 text-sm text-neutral-600">
        Bar is fixed to the top of the viewport. Increment the stub's counter to show it.
      </p>
      <button
        class="rounded-ep-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white"
        onclick="window.__epStubInc && window.__epStubInc()"
      >
        Trigger
      </button>
      <app-global-progress-bar />
    `,
  }),
};

export const Hidden: Story = {
  render: () => ({
    template: `
      <p class="text-sm text-neutral-500">
        Counter = 0 → bar not rendered (default LoadingService state).
      </p>
      <app-global-progress-bar />
    `,
  }),
};
