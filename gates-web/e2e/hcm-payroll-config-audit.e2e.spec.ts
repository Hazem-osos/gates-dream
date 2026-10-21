import { test, expect } from '@playwright/test';

function auditHeading(page: import('@playwright/test').Page) {
  return page.locator('main').getByRole('heading', { name: /سجل تدقيق إعدادات الرواتب/i });
}

test.describe('Payroll config audit', () => {
  test('unified audit page loads with filters', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/hr/payroll/config-audit');
    await expect(page).toHaveURL(/\/hr\/payroll\/config-audit/);
    await expect(auditHeading(page)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gates:nav-sidebar-collapse'));
    });
    await expect(page.getByTestId('config-audit-filters')).toBeVisible();
    await page.getByTestId('config-audit-filters').locator('select').selectOption('HCM_PAYROLL_RULE');
    await expect(page.getByText(/حدث|لا توجد أحداث/).first()).toBeVisible({ timeout: 20_000 });
  });
});
