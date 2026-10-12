import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const hasAuth = (() => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.auth', 'hcm-user.json'), 'utf8');
    const state = JSON.parse(raw) as { cookies?: unknown[] };
    return (state.cookies?.length ?? 0) > 0;
  } catch {
    return false;
  }
})();

test.describe('HCM payroll admin', () => {
  test.skip(!hasAuth, 'Set E2E_HCM_EMAIL/E2E_HCM_PASSWORD for login');

  test('rules and localization admin screens load', async ({ page }) => {
    await page.goto('/hr/payroll/rules');
    await expect(page.getByRole('heading', { name: /قواعد الرواتب/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/hr/payroll/localization');
    await expect(page.getByRole('heading', { name: /توطين الرواتب/i })).toBeVisible();
  });
});
