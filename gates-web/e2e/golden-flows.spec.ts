import { test, expect } from '@playwright/test';

test.describe('Arabic golden flows', () => {
  test('login offers password recovery', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /نسيت|Forgot password/ })).toBeVisible();
  });

  test('forgot-password accepts an email', async ({ page }) => {
    await page.route('**/api/v1/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'إذا كان البريد مسجلاً ستصلك رسالة برابط الاستعادة',
        }),
      });
    });
    await page.goto('/forgot-password');
    await page.getByPlaceholder('البريد الإلكتروني').fill('user@example.com');
    await page.getByRole('button', { name: 'إرسال الرابط' }).click();
    await expect(page.getByText('إذا كان البريد مسجلاً ستصلك رسالة')).toBeVisible();
  });

  test('unavailable module stays in Arabic', async ({ page }) => {
    await page.goto('/electronic-invoices');
    await expect(page.getByText(/غير متاح|قريباً|هذه الشاشة/)).toBeVisible();
  });
});
