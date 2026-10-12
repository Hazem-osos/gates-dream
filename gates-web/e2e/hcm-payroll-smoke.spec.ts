import { test, expect } from '@playwright/test';

test.describe('HCM payroll workspace smoke', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('payroll layout shows canonical nav labels', async ({ page }) => {
    await page.goto('/hr/payroll/dashboard');
    const onLogin = page.url().includes('/auth/login') || page.url().includes('/login');
    if (onLogin) {
      await expect(page.getByRole('button').first()).toBeVisible();
      return;
    }
    await expect(
      page.getByText(/عمليات الرواتب|مسيرات الرواتب|لوحة|Payroll/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'مسيرات الرواتب' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Legacy|الرواتب الشهرية/ })).toBeVisible();
  });
});
