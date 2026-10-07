import { test, expect } from '@playwright/test';

test.describe('HCM payroll workspace smoke', () => {
  test('payroll layout shows canonical nav labels', async ({ page }) => {
    await page.goto('/hr/payroll/dashboard');
    const onLogin = page.url().includes('/auth/login') || page.url().includes('/login');
    if (onLogin) {
      await expect(page.getByRole('button').first()).toBeVisible();
      return;
    }
    await expect(page.getByText('عمليات الرواتب (HCM)')).toBeVisible();
    await expect(page.getByRole('link', { name: 'مسيرات الرواتب' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Legacy|الرواتب الشهرية/ })).toBeVisible();
  });
});
