import { test, expect } from '@playwright/test';

/**
 * HR employee form — Zod client validation (no full submit to API).
 */
test.describe('Employee data Zod validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/hr/departments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              code: 'D1',
              arabicName: 'قسم تجريبي',
            },
          ],
          pagination: { page: 1, limit: 500, total: 1, totalPages: 1 },
        }),
      });
    });

    await page.goto('/hr/employee-data');
    await expect(page.getByRole('heading', { name: /بيانات موظف/ })).toBeVisible();
  });

  test('shows Arabic Zod errors when saving an empty profile', async ({ page }) => {
    await page.getByRole('button', { name: 'حفظ' }).click();

    await expect(page.getByText(/اسم الموظف مطلوب/)).toBeVisible();
    await expect(page.getByText(/رقم الهوية مطلوب/)).toBeVisible();
    await expect(page.getByText(/تاريخ الالتحاق بالعمل مطلوب/)).toBeVisible();
    // Empty input → preprocess NaN; Zod `number()` reports غير صالح before refine (مطلوب / > 0).
    await expect(
      page.getByText(/الراتب الأساسي (غير صالح|مطلوب|يجب أن يكون أكبر من صفر)/)
    ).toBeVisible();
    await expect(page.getByText(/يجب اختيار القسم/)).toBeVisible();
  });
});
