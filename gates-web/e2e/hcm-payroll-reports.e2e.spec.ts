import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const credFile = path.join(__dirname, '.auth', 'e2e-credentials.json');

type E2eCreds = {
  branchId?: string;
  fiscalYearId?: string;
  payrollRunId?: string;
};

function readCreds(): E2eCreds | null {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, 'utf8')) as E2eCreds;
}

function reportsHeading(page: import('@playwright/test').Page) {
  return page.locator('main').getByRole('heading', { name: /تقارير الرواتب/i });
}

async function authHeaders(page: import('@playwright/test').Page, cred: E2eCreds | null) {
  const cookies = await page.context().cookies();
  const tokenCookie =
    cookies.find((c) => c.name === 'auth_token') ?? cookies.find((c) => c.name === 'accessToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tokenCookie?.value) headers.Authorization = `Bearer ${tokenCookie.value}`;
  if (cred?.branchId) headers['X-Branch-Id'] = cred.branchId;
  if (cred?.fiscalYearId) headers['X-Fiscal-Year-Id'] = cred.fiscalYearId;
  return headers;
}

test.describe('Payroll reports — filters and pagination', () => {
  test('run picker, register pagination, and filter reset', async ({ page, request }) => {
    test.setTimeout(180_000);
    const cred = readCreds();
    await page.goto('/hr/payroll/reports');
    await expect(page).toHaveURL(/\/hr\/payroll\/reports/);
    await expect(reportsHeading(page)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gates:nav-sidebar-collapse'));
    });

    const headers = await authHeaders(page, cred);
    let runId = cred?.payrollRunId;
    if (!runId) {
      const runsRes = await request.get('http://localhost:3001/api/v1/hr/payroll/runs?pageSize=5', {
        headers,
      });
      expect(runsRes.ok()).toBeTruthy();
      const runsBody = await runsRes.json();
      runId = runsBody.data?.rows?.[0]?.id;
    }
    expect(runId).toBeTruthy();

    await page.getByTestId('payroll-run-picker').locator('input.font-mono').fill(runId!);

    const reportSelect = page.getByTestId('payroll-report-filters').locator('select');
    await reportSelect.selectOption('register');
    await expect(page.getByText('إجماليات التقرير')).toBeVisible({ timeout: 30_000 });

    await page
      .getByTestId('payroll-report-filters')
      .locator('label')
      .filter({ hasText: 'بحث' })
      .locator('input')
      .fill('اختبار');
    await expect(page.getByText('لا توجد سجلات')).toBeVisible({ timeout: 15_000 });

    const clearBtn = page.getByTestId('payroll-report-filters').getByRole('button', { name: 'مسح الفلاتر' });
    await clearBtn.scrollIntoViewIfNeeded();
    await clearBtn.evaluate((el) => (el as HTMLButtonElement).click());
    await expect(
      page.getByTestId('payroll-report-filters').locator('label').filter({ hasText: 'بحث' }).locator('input')
    ).toHaveValue('');
  });
});
