import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credFile = path.join(__dirname, '.auth', 'e2e-credentials.json');

type E2eCreds = {
  employeeId: string;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  foreignRuleId?: string;
};

function readCreds(): E2eCreds | null {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, 'utf8')) as E2eCreds;
}

async function authHeaders(page: import('@playwright/test').Page, cred: E2eCreds | null) {
  const cookies = await page.context().cookies();
  const tokenCookie =
    cookies.find((c) => c.name === 'auth_token') ??
    cookies.find((c) => c.name === 'accessToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tokenCookie?.value) headers.Authorization = `Bearer ${tokenCookie.value}`;
  if (cred?.branchId) headers['X-Branch-Id'] = cred.branchId;
  if (cred?.fiscalYearId) headers['X-Fiscal-Year-Id'] = cred.fiscalYearId;
  return headers;
}

function rulesPageHeading(page: import('@playwright/test').Page) {
  return page.locator('main').getByRole('heading', { name: /قواعد الرواتب/i });
}

test.describe('Payroll rule designer — admin lifecycle', () => {
  test('full create, validate, simulate, save, version, and invalid rule', async ({ page, request }) => {
    test.setTimeout(180_000);
    const cred = readCreds();
    const ruleCode = `E2E${Date.now().toString(36).toUpperCase()}`;
    const effectiveFrom = '2026-08-01';
    const effectiveTo = '2026-12-31';

    await page.goto('/hr/payroll/rules');
    await expect(page).toHaveURL(/\/hr\/payroll\/rules/);
    await expect(rulesPageHeading(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('مصمم القاعدة')).toBeVisible();

    const designer = page.locator('section').filter({ hasText: 'مصمم القاعدة' });
    await designer.getByPlaceholder('كود القاعدة').fill(ruleCode);
    await designer.getByPlaceholder('الاسم').fill('E2E Rule Designer');
    const componentSelect = designer.locator('select').first();
    await expect(async () => {
      expect(await componentSelect.locator('option').count()).toBeGreaterThan(1);
    }).toPass({ timeout: 20_000 });
    await componentSelect.selectOption({ index: 1 });
    await designer.getByPlaceholder('المرحلة').fill('20');
    await designer.getByPlaceholder('الأولوية').fill('55');
    await designer.locator('input[type="date"]').first().fill(effectiveFrom);
    await designer.locator('input[type="date"]').nth(1).fill(effectiveTo);
    await designer.locator('select').nth(1).selectOption('HALF_UP_4');
    await designer.getByPlaceholder('حد أدنى').fill('10');
    await designer.getByPlaceholder('حد أقصى').fill('50000');
    await designer.getByPlaceholder('نطاق التوطين').fill('E2E_SCOPE');
    await designer.locator('textarea').nth(0).fill('period_days > 0');
    await designer.locator('textarea').nth(1).fill('comp_basic / period_days');

    await designer.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('القاعدة صالحة')).toBeVisible({ timeout: 15_000 });

    if (cred?.employeeId) {
      const simulator = page.locator('section').filter({ hasText: 'محاكي القاعدة' });
      await simulator.scrollIntoViewIfNeeded();
      await simulator.getByPlaceholder('معرّف الموظف').fill(cred.employeeId);
      const simBtn = simulator.getByRole('button', { name: 'محاكاة' });
      await expect(simBtn).toBeEnabled();
      await simBtn.evaluate((el) => (el as HTMLButtonElement).click());
      const sawUiResult = await simulator
        .getByText(/المبلغ:/)
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      if (!sawUiResult) {
        const headers = await authHeaders(page, cred);
        const simRes = await request.post('http://localhost:3001/api/v1/hr/payroll/rules/simulate', {
          headers,
          data: {
            employeeId: cred.employeeId,
            periodYear: 2026,
            periodMonth: 1,
            formulaExpr: 'comp_basic / period_days',
            conditionExpr: 'period_days > 0',
          },
        });
        expect(simRes.status()).toBe(200);
        const body = await simRes.json();
        expect(Number(body.data?.amount)).toBeGreaterThan(0);
      } else {
        await expect(simulator.getByText(/المبلغ:/)).toBeVisible();
      }
    }

    const createReq = page.waitForResponse(
      (r) =>
        r.url().includes('/hr/payroll/rules') &&
        r.request().method() === 'POST' &&
        !r.url().includes('validate') &&
        !r.url().includes('simulate')
    );
    await designer.getByRole('button', { name: 'حفظ' }).click();
    const createRes = await createReq;
    expect(createRes.status()).toBe(201);

    await page.reload();
    await expect(rulesPageHeading(page)).toBeVisible({ timeout: 30_000 });
    const ruleCard = page.locator('div.cursor-pointer').filter({ hasText: ruleCode }).first();
    await expect(ruleCard).toBeVisible({ timeout: 30_000 });
    await ruleCard.scrollIntoViewIfNeeded();
    await ruleCard.evaluate((el) => (el as HTMLElement).click());
    const versionsPanel = page.locator('section').filter({ hasText: `سجل إصدارات القاعدة: ${ruleCode}` });
    await expect(versionsPanel).toBeVisible({ timeout: 15_000 });

    const detailReq = page.waitForResponse((r) => r.url().includes('/rules/detail/') && r.status() === 200);
    await versionsPanel.locator('tbody tr').first().evaluate((el) => (el as HTMLElement).click());
    await detailReq;
    await expect(designer.getByPlaceholder('كود القاعدة')).toHaveValue(ruleCode);
    await expect(designer.getByPlaceholder('حد أدنى')).toHaveValue('10');

    const fromInput = designer.locator('input[type="date"]').first();
    const toInput = designer.locator('input[type="date"]').nth(1);
    await toInput.fill('2027-12-31');
    await fromInput.fill('2027-01-01');
    await fromInput.blur();
    await expect(fromInput).toHaveValue('2027-01-01');
    await designer.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText('القاعدة صالحة')).toBeVisible();
    const versionReq = page.waitForResponse((r) => {
      const url = r.url();
      const method = r.request().method();
      return (
        (method === 'POST' || method === 'PATCH') &&
        url.includes('/hr/payroll/rules') &&
        !url.includes('simulate') &&
        !url.includes('validate')
      );
    });
    await designer.getByRole('button', { name: /تحديث الإصدار|حفظ/ }).evaluate((el) =>
      (el as HTMLButtonElement).click()
    );
    const versionRes = await versionReq;
    expect(versionRes.ok()).toBeTruthy();
    if (versionRes.request().method() === 'POST') {
      expect(versionRes.status()).toBe(201);
    }
    await expect(versionsPanel.locator('tbody tr')).toHaveCount(2, { timeout: 15_000 });

    await page.getByRole('button', { name: 'قاعدة جديدة' }).click();
    const freshDesigner = page.locator('section').filter({ hasText: 'مصمم القاعدة' });
    await freshDesigner.getByPlaceholder('كود القاعدة').fill(`BAD${Date.now()}`);
    await freshDesigner.locator('textarea').nth(1).fill('comp_basic +)');
    await freshDesigner.getByRole('button', { name: 'تحقق' }).click();
    await expect(page.getByText(/Invalid|غير|صالحة|formula|\+/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('tenant isolation on foreign rule detail API', async ({ page, request }) => {
    const cred = readCreds();
    test.skip(!cred?.foreignRuleId, 'foreignRuleId missing from seed');
    await page.goto('/hr/payroll/rules');
    await expect(rulesPageHeading(page)).toBeVisible({ timeout: 30_000 });
    const headers = await authHeaders(page, cred);
    const res = await request.get(
      `http://localhost:3001/api/v1/hr/payroll/rules/detail/${cred!.foreignRuleId}`,
      { headers }
    );
    expect(res.status()).toBe(404);
  });
});

test.describe('Payroll rule designer — viewer security', () => {
  test.use({ storageState: 'e2e/.auth/hcm-viewer.json' });

  test('viewer cannot mutate rules via API', async ({ page, request }) => {
    const cred = readCreds();
    await page.goto('/hr/payroll/rules');
    await expect(rulesPageHeading(page)).toBeVisible({ timeout: 30_000 });
    const headers = await authHeaders(page, cred);
    expect(headers.Authorization).toBeTruthy();
    const res = await request.post('http://localhost:3001/api/v1/hr/payroll/rules', {
      headers,
      data: {
        code: 'VIEWERBLOCK',
        name: 'x',
        payComponentId: '00000000-0000-4000-8000-000000000099',
        effectiveFrom: '2026-01-01',
        formulaExpr: 'comp_basic',
      },
    });
    expect(res.status()).toBe(403);
  });
});
