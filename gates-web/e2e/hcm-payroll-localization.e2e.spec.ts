import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credFile = path.join(__dirname, '.auth', 'e2e-credentials.json');

type E2eCreds = {
  foreignLocalizationId?: string;
};

function readCreds(): E2eCreds | null {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, 'utf8')) as E2eCreds;
}

function locHeading(page: import('@playwright/test').Page) {
  return page.locator('main').getByRole('heading', { name: /توطين الرواتب/i });
}

test.describe('Payroll localization — admin lifecycle', () => {
  test('validate, save, reload, version, audit', async ({ page }) => {
    test.setTimeout(180_000);
    const effectiveFrom = `2026-10-${String((Date.now() % 20) + 1).padStart(2, '0')}`;
    const effectiveTo = '2026-12-31';
    const capValue = String(11000 + (Date.now() % 1000));

    await page.goto('/hr/payroll/localization');
    await expect(page).toHaveURL(/\/hr\/payroll\/localization/);
    await expect(locHeading(page)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gates:nav-sidebar-collapse'));
    });

    const designer = page.getByTestId('loc-designer');
    await designer.scrollIntoViewIfNeeded();
    await designer.getByRole('combobox').first().selectOption('EG');
    await designer.locator('select').nth(1).selectOption('INSURANCE_CAP');
    await designer.locator('label').filter({ hasText: 'maxBase' }).locator('input').fill('-1');
    await designer.locator('input[type="date"]').first().fill(effectiveFrom);
    const validateBtn = designer.getByRole('button', { name: 'تحقق' });
    await expect(validateBtn).toBeVisible();
    await validateBtn.click();
    await expect(page.getByText(/maxBase|سقف|Invalid|صالح/i).first()).toBeVisible({ timeout: 15_000 });

    await designer.locator('label').filter({ hasText: 'maxBase' }).locator('input').fill(capValue);
    await designer.locator('input[type="date"]').nth(1).fill(effectiveTo);
    await designer.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('الإعداد صالح (TEST)')).toBeVisible({ timeout: 15_000 });

    const createReq = page.waitForResponse(
      (r) => r.url().includes('/hr/payroll/localization') && r.request().method() === 'POST' && !r.url().includes('validate')
    );
    await designer.getByRole('button', { name: 'حفظ إصدار' }).click();
    const createRes = await createReq;
    expect(createRes.status()).toBe(201);

    await page.reload();
    await expect(locHeading(page)).toBeVisible({ timeout: 30_000 });
    const row = page.locator('tbody tr').filter({ hasText: 'INSURANCE_CAP' }).filter({ hasText: effectiveFrom }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(designer.locator('label').filter({ hasText: 'maxBase' }).locator('input')).toHaveValue(capValue);

    await designer.getByRole('button', { name: 'إصدار جديد' }).click();
    await designer.locator('input[type="date"]').first().fill('2027-01-01');
    await designer.locator('label').filter({ hasText: 'maxBase' }).locator('input').fill('15000');
    await designer.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('الإعداد صالح (TEST)')).toBeVisible();
    const v2Req = page.waitForResponse(
      (r) => r.url().includes('/hr/payroll/localization') && r.request().method() === 'POST' && !r.url().includes('validate')
    );
    await designer.getByRole('button', { name: 'حفظ إصدار' }).click();
    expect((await v2Req).status()).toBe(201);

    await expect(page.getByText('سجل إجراءات التوطين')).toBeVisible();
    await expect(page.locator('ul').filter({ hasText: 'توطين' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('tenant isolation on foreign localization detail', async ({ page, request }) => {
    const cred = readCreds();
    test.skip(!cred?.foreignLocalizationId, 'foreignLocalizationId missing from seed');
    await page.goto('/hr/payroll/localization');
    await expect(locHeading(page)).toBeVisible({ timeout: 30_000 });
    const cookies = await page.context().cookies();
    const tokenCookie =
      cookies.find((c) => c.name === 'auth_token') ?? cookies.find((c) => c.name === 'accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tokenCookie?.value) headers.Authorization = `Bearer ${tokenCookie.value}`;
    const res = await request.get(
      `http://localhost:3001/api/v1/hr/payroll/localization/detail/${cred!.foreignLocalizationId}`,
      { headers }
    );
    expect(res.status()).toBe(404);
  });
});

test.describe('Payroll localization — viewer security', () => {
  test.use({ storageState: 'e2e/.auth/hcm-viewer.json' });

  test('viewer cannot create localization via API', async ({ page, request }) => {
    await page.goto('/hr/payroll/localization');
    await expect(locHeading(page)).toBeVisible({ timeout: 30_000 });
    const cookies = await page.context().cookies();
    const tokenCookie =
      cookies.find((c) => c.name === 'auth_token') ?? cookies.find((c) => c.name === 'accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tokenCookie?.value) headers.Authorization = `Bearer ${tokenCookie.value}`;
    const res = await request.post('http://localhost:3001/api/v1/hr/payroll/localization', {
      headers,
      data: {
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: '2026-01-01',
        config: { maxBase: 1 },
      },
    });
    expect(res.status()).toBe(403);
  });
});
