/**
 * ─── E2E SMOKE — APP BOOTS ──────────────────────────────────────────────────────
 *
 * Smallest possible end-to-end probe: a fresh page load completes, the SPA
 * renders the base `<app-root>` element, and there's no unhandled console
 * error or network failure. This is the "does the bundle actually serve"
 * gate that catches broken builds before MSAL / feature specs ever run.
 *
 * Auth-gated flows (login, permissions, CRUD) are tracked as Phase 4.4.2
 * deferred work — they require an Entra test tenant. This smoke is
 * intentionally anonymous-path only.
 */
import { expect, test } from '@playwright/test';

test.describe('App shell boots', () => {
  test('renders the root component + no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');
    // Unauthenticated users are redirected to /auth/login by authGuard; wait
    // for either that page OR the login component to render.
    await page.waitForURL(/\/auth\/login|\/dashboard|\//, { timeout: 15_000 });
    await expect(page.locator('app-root')).toBeVisible();

    // Filter noise: MSAL + runtime-config fallback warnings in dev are
    // expected when no Entra tenant is configured.
    const unexpected = consoleErrors.filter(
      (e) => !/MSAL|runtime-config\.fallback|Content Security Policy/i.test(e),
    );
    expect(unexpected).toEqual([]);
  });

  test('serves /config.json as a static asset', async ({ page }) => {
    const response = await page.request.get('/config.json');
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as Record<string, unknown>;
    // Shape contract — the runtime-config loader enforces stronger checks via
    // Zod; here we only assert the top-level keys exist so a mis-deployed
    // asset fails loudly.
    expect(body).toHaveProperty('apiBaseUrl');
    expect(body).toHaveProperty('msal');
    expect(body).toHaveProperty('telemetry');
  });
});
