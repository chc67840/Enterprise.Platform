/**
 * ─── POST-SCSS-MIGRATION VISUAL BASELINES ──────────────────────────────────
 *
 * Captured at the end of the Phase 3 CSS → SCSS migration. The migration was
 * a pure refactor (extract inline `styles: []` arrays to sibling
 * `*.component.scss` files; lift PrimeNG-targeting `:host ::ng-deep .p-*`
 * blocks to `src/styles/_primeng-overrides.scss`) so the rendered output
 * MUST be byte-for-byte identical at the painted-pixel level.
 *
 * SCOPE
 *   - /auth/login       → unauth landing page (logo + form + footer)
 *   - /                 → root which authGuard redirects to /auth/login;
 *                         exercises the redirect path + same render
 *
 * NOT COVERED
 *   - /dashboard authenticated — no Entra test tenant in CI yet
 *     (tracked at app-boots.spec.ts:9 — Phase 4.4.2 deferred)
 *
 * BASELINE MANAGEMENT
 *   First run captures `__screenshots__/post-scss-migration.spec.ts/*.png`.
 *   Re-running compares pixel-wise with `maxDiffPixelRatio: 0.02` (2% — tight
 *   enough to catch real visual breaks, loose enough to absorb font hinting
 *   differences across platforms).
 *
 *   To accept an intentional visual change: re-run with
 *   `npx playwright test --update-snapshots` and commit the new PNGs.
 */
import { test, expect } from '@playwright/test';

test.describe('Post-SCSS-migration visual baselines', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    // Wait for the initial font swap so screenshot is stable.
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('root redirects to login + renders chrome', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('root-redirect.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
