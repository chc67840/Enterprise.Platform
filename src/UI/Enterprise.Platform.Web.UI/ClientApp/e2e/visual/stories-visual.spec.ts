/**
 * ─── STORYBOOK VISUAL REGRESSION ────────────────────────────────────────────────
 *
 * Phase 5.2 scope — Playwright snapshots each canonical story page and
 * compares against committed baselines under `e2e/visual/__screenshots__/`.
 * Reviewers approve diffs via the GitHub PR checks view.
 *
 * EXPECTED USAGE
 *   1. Build Storybook: `npm run build-storybook` (or leave dev server running).
 *   2. Serve static: `npx http-server storybook-static -p 6006` (or start dev).
 *   3. Run: `npm run test:e2e -- e2e/visual` — on first run, baselines are
 *      captured; subsequent runs compare pixel-wise with a tolerance.
 *
 * WHY A CURATED LIST (not every story)
 *   Story pages like the Tokens catalogue can fluctuate based on font
 *   rendering across platforms; only stable-layout primitives are listed
 *   here. The a11y test-runner (5.1.5) exercises every story for
 *   violations — that coverage plus this curated visual set is the Phase-5
 *   regression story.
 *
 * BASELINE MANAGEMENT
 *   Commit `__screenshots__/` after any intentional visual change. CI
 *   blocks PRs on pixel diffs > `maxDiffPixelRatio` (set per assertion).
 */
import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env['STORYBOOK_URL'] ?? 'http://localhost:6006';

const STORIES = [
  // id, label
  ['primitives-statusbadge--success', 'status-badge-success'],
  ['primitives-statusbadge--all-variants', 'status-badge-all-variants'],
  ['primitives-pageheader--default', 'page-header-default'],
  ['primitives-emptystate--no-data', 'empty-state-no-data'],
  ['primitives-errorstate--default', 'error-state-default'],
  ['primitives-skeletoncard--card', 'skeleton-card'],
] as const;

test.describe('Storybook visual regression', () => {
  for (const [id, label] of STORIES) {
    test(`${label}`, async ({ page }) => {
      // iframe.html hosts a single story without Storybook chrome.
      await page.goto(`${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story`);
      // Wait for the story root to render + fonts to load — cheap proxy for
      // "page is stable" without needing story-specific selectors.
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${label}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
