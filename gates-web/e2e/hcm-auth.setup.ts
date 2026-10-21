import { test as setup, expect } from '@playwright/test';

setup.setTimeout(120_000);
import fs from 'node:fs';
import path from 'node:path';

const authDir = path.join(__dirname, '.auth');
const adminAuthFile = path.join(authDir, 'hcm-user.json');
const viewerAuthFile = path.join(authDir, 'hcm-viewer.json');
const credFile = path.join(authDir, 'e2e-credentials.json');

type E2eCreds = {
  email: string;
  password: string;
  companyId: string;
  fiscalYearId: string;
  branchId: string;
  employeeId: string;
  viewerEmail?: string;
  viewerPassword?: string;
  foreignRuleId?: string;
};

function readCreds(): E2eCreds | null {
  if (!fs.existsSync(credFile)) return null;
  return JSON.parse(fs.readFileSync(credFile, 'utf8')) as E2eCreds;
}

async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  tenant: Pick<E2eCreds, 'companyId' | 'branchId' | 'fiscalYearId'>,
  outFile: string
) {
  await page.goto('/login');
  await page.locator('#username').fill(email);
  await page.locator('#password').fill(password);
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );
  await page.getByRole('button', { name: /تسجيل الدخول|Login/i }).click();
  const loginRes = await loginResponse;
  expect(loginRes.ok(), `login failed: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
  await page.evaluate((t) => {
    localStorage.setItem('gates_tenant_company_id', t.companyId);
    localStorage.setItem('gates_tenant_branch_id', t.branchId);
    localStorage.setItem('gates_tenant_fiscal_year_id', t.fiscalYearId);
    window.dispatchEvent(new Event('gates:tenant-context-ready'));
  }, tenant);
  await page.context().storageState({ path: outFile });
}

setup('seed payroll admin session', async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });
  const cred = readCreds();
  const useSeedCreds = process.env.E2E_AUTO_SEED === '1' && cred?.email && cred?.password;
  const email = useSeedCreds ? cred!.email : process.env.E2E_HCM_EMAIL ?? cred?.email;
  const password = useSeedCreds ? cred!.password : process.env.E2E_HCM_PASSWORD ?? cred?.password;
  if (!email || !password || !cred?.companyId) {
    throw new Error(
      'HCM E2E auth: run with E2E_AUTO_SEED=1 (and DATABASE_URL) or provide e2e/.auth/e2e-credentials.json'
    );
  }
  await loginAndSave(page, email, password, cred, adminAuthFile);
  await page.goto('/hr/payroll/dashboard');
  await expect(page.getByRole('heading', { name: /عمليات الرواتب/i }).first()).toBeVisible({
    timeout: 30_000,
  });
});

const credForViewer = readCreds();
setup.skip(!credForViewer?.viewerEmail, 'Viewer not in seed output');

setup('seed payroll viewer session', async ({ page }) => {
  const cred = readCreds();
  if (!cred?.viewerEmail || !cred.viewerPassword) return;
  await loginAndSave(page, cred.viewerEmail, cred.viewerPassword, cred, viewerAuthFile);
});
