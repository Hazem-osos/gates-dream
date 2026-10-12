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

test.describe('HCM payroll operations', () => {
  test.skip(!hasAuth, 'Set E2E_HCM_EMAIL/E2E_HCM_PASSWORD (or E2E_PAYROLL_*) for login');

  test('dashboard through reports (smoke path)', async ({ page }) => {
    await page.goto('/hr/payroll/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة|مسيرات|Payroll/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/hr/payroll/reports');
    await expect(page.getByRole('heading', { name: /تقارير الرواتب/i })).toBeVisible();
  });

  test('responsive payroll reports at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/hr/payroll/reports');
    await expect(page.getByRole('heading', { name: /تقارير الرواتب/i })).toBeVisible();
  });
});
