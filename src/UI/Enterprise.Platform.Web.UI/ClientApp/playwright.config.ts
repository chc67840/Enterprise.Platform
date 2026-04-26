/**
 * ─── PLAYWRIGHT CONFIG ──────────────────────────────────────────────────────────
 *
 * E2E scaffold. Real happy-path specs land when feature work begins —
 * post-Phase-9 the BFF cookie-session flow can be exercised without an
 * external Entra dependency for read-only smoke tests; full sign-in flows
 * still require a test tenant when that work is scheduled.
 *
 * What this config does today:
 *   - Boots the dev server (`ng serve` via `npm run start`) before running
 *     specs so the suite never fails on a cold box.
 *   - Targets Chromium by default; additional browser matrices can be
 *     enabled here when the suite stabilizes.
 *   - Screenshot on failure, trace on first retry — cheap debug data.
 *
 * WHY ONLY CHROMIUM AT FIRST
 *   Cross-browser matrix expansion is cheap to add when a real feature
 *   reaches "visual regression worthy" state. Today's surface (auth shell
 *   + dashboard placeholder) doesn't justify the CI cost.
 */
import { defineConfig, devices } from '@playwright/test';

const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse an already-running dev server when present; otherwise spin one up.
  // `reuseExistingServer` keeps iteration fast locally.
  webServer: {
    command: 'npm run start',
    url: baseUrl,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
