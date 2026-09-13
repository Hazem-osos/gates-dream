import { test, expect } from '@playwright/test';

/**
 * Journal entry happy path with API mocked (balanced debit/credit).
 */
test.describe('Journal entry smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/accounting/accounts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', code: '101', arabicName: 'حساب مدين' },
            { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', code: '201', arabicName: 'حساب دائن' },
          ],
        }),
      });
    });

    await page.route('**/api/v1/accounting/currencies**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [{ id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', code: 'EGP', arabicName: 'جنيه مصري' }],
        }),
      });
    });

    await page.route('**/api/v1/accounting/journal-entries**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            data: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          }),
        });
        return;
      }
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', data: { id: 'je-smoke-1' } }),
        });
        return;
      }
      return route.continue();
    });
  });

  test('submits balanced journal entry and shows success toast', async ({ page }) => {
    await page.goto('/accounting/operations/journal-entry');
    await expect(page.getByRole('heading', { name: /قيد يومية/ })).toBeVisible();

    await page.getByPlaceholder('إدخل الشرح').fill('اختبار Playwright — قيد متوازن');

    await page.getByRole('button', { name: 'إضافة' }).click();
    await page.getByRole('button', { name: 'إضافة' }).click();

    const tableSelects = page.locator('table select');
    await tableSelects.nth(0).selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
    await tableSelects.nth(2).selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');

    const numberInputs = page.locator('table input[type="number"]');
    await numberInputs.nth(0).fill('100');
    await numberInputs.nth(1).fill('0');
    await numberInputs.nth(3).fill('0');
    await numberInputs.nth(4).fill('100');

    await page.getByRole('button', { name: 'حفظ' }).click();

    await expect(page.getByText('تم حفظ القيد بنجاح')).toBeVisible();
    await expect(page.getByText('نجح')).toBeVisible();
  });
});
