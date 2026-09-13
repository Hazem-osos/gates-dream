// One-off audit script: logs in as the demo user and crawls key pages,
// capturing screenshots + console/network errors so we know what's demo-safe.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'demo-audit', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const routes = [
  // Dashboard / top-level
  { name: 'dashboard', path: '/dashboard' },
  { name: 'executive', path: '/executive' },
  { name: 'profile', path: '/profile' },
  { name: 'settings', path: '/settings' },

  // Accounting
  { name: 'accounting-home', path: '/accounting' },
  { name: 'accounting-chart-of-accounts', path: '/accounting/chart-of-accounts' },
  { name: 'accounting-journal-entry', path: '/accounting/operations/journal-entry' },
  { name: 'accounting-treasury', path: '/accounting/operations/treasury' },
  { name: 'accounting-account-movement-report', path: '/accounting/account-reports/moves' },
  { name: 'accounting-balances-report', path: '/accounting/account-reports/balances' },
  { name: 'accounting-cards-customer', path: '/accounting/cards/customer' },

  // Inventory
  { name: 'inventory-home', path: '/inventory' },
  { name: 'inventory-items', path: '/inventory/creations/items' },
  { name: 'inventory-customers', path: '/inventory/creations/customers' },
  { name: 'inventory-sales-invoice', path: '/inventory/operations/sales-invoice' },
  { name: 'inventory-purchase-order', path: '/inventory/operations/purchase-order' },
  { name: 'inventory-item-balances', path: '/inventory/reports/item-balances' },
  { name: 'inventory-sales-reports', path: '/inventory/reports/sales-reports' },

  // HR
  { name: 'hr-home', path: '/hr' },
  { name: 'hr-employees', path: '/hr/employees' },
  { name: 'hr-monthly-salaries', path: '/hr/monthly-salaries' },
  { name: 'hr-payroll', path: '/hr/payroll' },
  { name: 'hr-departments', path: '/hr/departments' },

  // Taxes
  { name: 'taxes-home', path: '/taxes' },
  { name: 'taxes-vat-declaration', path: '/taxes/operations/vat-declaration' },
  { name: 'taxes-tax-authorities', path: '/taxes/creations/tax-authorities' },

  // POS
  { name: 'pos-home', path: '/pos' },
  { name: 'pos-point-of-sale', path: '/pos/point-of-sale' },
  { name: 'pos-daily', path: '/pos/daily' },

  // Manufacturing
  { name: 'manufacturing-home', path: '/manufacturing' },
  { name: 'manufacturing-model', path: '/manufacturing/creations/manufacturing-model' },
  { name: 'manufacturing-operation', path: '/manufacturing/operations/operation' },

  // Real Estate
  { name: 'real-estate-home', path: '/real-estate-investment' },
  { name: 'real-estate-property', path: '/real-estate-investment/create/property' },
  { name: 'real-estate-reservation', path: '/real-estate-investment/operations/reservation' },

  // Schools
  { name: 'schools-home', path: '/schools' },
  { name: 'schools-student-data', path: '/schools/student-data' },

  // Extracts (contracting)
  { name: 'extracts-home', path: '/extracts' },
  { name: 'extracts-projects', path: '/extracts/operations/projects' },
  { name: 'contracting-home', path: '/contracting' },

  // Electronic invoices
  { name: 'einvoice-home', path: '/electronic-invoices' },
  { name: 'einvoice-send-invoice', path: '/electronic-invoices/creations/send-invoice' },

  // Misc
  { name: 'accounts-home', path: '/accounts' },
  { name: 'electronic-audit-home', path: '/electronic-audit' },
  { name: 'importexport-home', path: '/importexport' },
  { name: 'help-home', path: '/help' },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  let currentRoute = 'login';

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.push({ route: currentRoute, kind: 'console-error', detail: msg.text().slice(0, 500) });
    }
  });
  page.on('requestfailed', (req) => {
    results.push({ route: currentRoute, kind: 'request-failed', detail: `${req.method()} ${req.url()} :: ${req.failure()?.errorText}` });
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      results.push({ route: currentRoute, kind: 'http-error', detail: `${res.status()} ${res.url()}` });
    }
  });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', 'osama@gmail.com');
  await page.fill('#password', '12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-login-result.png'), fullPage: true });

  const summary = [];

  for (const [i, r] of routes.entries()) {
    currentRoute = r.name;
    const before = results.length;
    try {
      await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1200);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const looksBroken = /application error|internal server error|500|unhandled/i.test(bodyText) &&
        !/تصدير|500\)/.test(bodyText); // crude check, refined below
      const title = await page.title().catch(() => '');
      const file = String(i + 1).padStart(2, '0') + '-' + r.name + '.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, file), fullPage: false });
      const newIssues = results.slice(before);
      summary.push({
        route: r.name,
        path: r.path,
        title,
        screenshot: file,
        issueCount: newIssues.length,
        bodySnippet: bodyText.slice(0, 200).replace(/\s+/g, ' '),
      });
    } catch (e) {
      summary.push({ route: r.name, path: r.path, error: String(e).slice(0, 300) });
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'demo-audit', 'report.json'),
    JSON.stringify({ summary, issues: results }, null, 2)
  );

  console.log('DONE');
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
