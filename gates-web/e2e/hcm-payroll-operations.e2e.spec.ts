import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credFile = path.join(__dirname, '.auth', 'e2e-credentials.json');

type E2eCreds = {
  payrollRunId?: string;
  employeeId?: string;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
};

function readCreds(): E2eCreds | null {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, 'utf8')) as E2eCreds;
}

function reviewHeading(page: import('@playwright/test').Page, year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  return page.locator('main').getByRole('heading', { name: `مسيرة ${year}-${mm}` });
}

test.describe('HCM payroll operations E2E', () => {
  test.beforeEach(async ({ page }) => {
    const cred = readCreds();
    if (!cred?.companyId) return;
    await page.goto('/hr/payroll/dashboard');
    await page.evaluate((t) => {
      localStorage.setItem('gates_tenant_company_id', t.companyId);
      localStorage.setItem('gates_tenant_branch_id', t.branchId);
      localStorage.setItem('gates_tenant_fiscal_year_id', t.fiscalYearId);
      window.dispatchEvent(new Event('gates:tenant-context-ready'));
    }, cred);
  });

  test('dashboard through reports (smoke path)', async ({ page }) => {
    await page.goto('/hr/payroll/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة|مسيرات|عمليات الرواتب/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.goto('/hr/payroll/reports');
    await expect(page.locator('main').getByRole('heading', { name: 'تقارير الرواتب', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('runs UI: preview and sync calculate for fresh period', async ({ page }) => {
    test.setTimeout(180_000);
    const cred = readCreds();
    test.skip(!cred?.branchId, 'E2E_AUTO_SEED credentials missing');

    const periodYear = 2026;
    const periodMonth = 11;

    await page.goto('/hr/payroll/runs');
    await expect(page.getByRole('heading', { name: 'مسيرات الرواتب' })).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gates:nav-sidebar-collapse'));
    });

    await page.getByRole('button', { name: 'إنشاء مسيرة' }).click();
    await page.getByLabel('السنة').fill(String(periodYear));
    await page.getByLabel('الشهر').fill(String(periodMonth));

    await page.getByRole('button', { name: 'معاينة (بدون آثار جانبية)' }).click();
    await expect(page.getByText(/معاينة الفترة 2026-11/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/جاهز:/)).toBeVisible();

    const calcReq = page.waitForResponse(
      (r) => r.url().includes('/hr/payroll-runs') && r.request().method() === 'POST' && !r.url().includes('calculate-async')
    );
    await page.getByRole('button', { name: 'احسب (مباشر)' }).click();
    const calcRes = await calcReq;
    expect(calcRes.status()).toBe(201);
    const body = (await calcRes.json()) as { data?: { id?: string } };
    const runId = body.data?.id;
    expect(runId).toBeTruthy();

    await page.goto(`/hr/payroll/runs/${runId}`);
    await expect(reviewHeading(page, periodYear, periodMonth)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('التسوية:').locator('..')).toContainText(/متوازن/);
    await expect(page.getByRole('link', { name: 'قسيمة الراتب' }).first()).toBeVisible();
  });

  test('review UI: approve and post accrual on seeded run', async ({ page }) => {
    test.setTimeout(180_000);
    const cred = readCreds();
    test.skip(!cred?.payrollRunId, 'Seeded payrollRunId missing — run with E2E_AUTO_SEED=1');

    await page.goto(`/hr/payroll/runs/${cred!.payrollRunId}`);
    await expect(page.locator('main').getByRole('heading', { name: /مسيرة 2026-/ })).toBeVisible({
      timeout: 30_000,
    });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gates:nav-sidebar-collapse'));
    });

    const statusLine = page.locator('main p').filter({ hasText: /CALCULATED|APPROVED|POSTED/ }).first();
    await expect(statusLine).toBeVisible();

    const statusText = (await statusLine.textContent()) ?? '';
    if (statusText.includes('CALCULATED')) {
      const approveReq = page.waitForResponse(
        (r) => r.url().includes('/approve') && r.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'اعتماد' }).click();
      const approveRes = await approveReq;
      expect(approveRes.ok()).toBeTruthy();
      await expect(statusLine).toContainText('APPROVED', { timeout: 15_000 });
    }

    const postBtn = page.getByRole('button', { name: 'ترحيل' });
    if (await postBtn.isVisible().catch(() => false)) {
      const disabled = await postBtn.isDisabled();
      if (!disabled) {
        await postBtn.click();
        const postReq = page.waitForResponse(
          (r) => r.url().includes('/post-accrual') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'تأكيد الترحيل' }).click();
        const postRes = await postReq;
        expect(postRes.ok()).toBeTruthy();
        await expect(statusLine).toContainText('POSTED', { timeout: 20_000 });
        await expect(page.getByText('قيد الترحيل:').locator('..')).toContainText(/…/);
      }
    }

    await page.goto('/hr/payroll/reports');
    await expect(page.locator('main').getByRole('heading', { name: 'تقارير الرواتب', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('payslip page loads from run review', async ({ page }) => {
    test.setTimeout(120_000);
    const cred = readCreds();
    test.skip(!cred?.payrollRunId || !cred?.employeeId, 'Seeded payroll run / employee missing');

    await page.goto(`/hr/payroll/runs/${cred!.payrollRunId}/payslip/${cred!.employeeId}`);
    await expect(page).toHaveURL(/\/payslip\//);
    await expect(page.locator('main').getByText(/قسيمة|صافي|الراتب/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('responsive payroll reports at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/hr/payroll/reports');
    await expect(page.locator('main').getByRole('heading', { name: 'تقارير الرواتب', exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
