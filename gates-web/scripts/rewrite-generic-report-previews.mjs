/**
 * Rewrites mock report preview pages to use ReportPreviewFromRegistry.
 * Skips previews that already have custom useApiQuery wiring.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '..', 'app');

const SKIP = new Set([
  'accounting/account-reports/analysis/profit-loss',
  'accounting/account-reports/books/journal-book',
  'accounting/account-reports/balances/accounts-balance',
  'inventory/reports/price-list',
  'inventory/reports/monthly-sales-for-items',
  'inventory/reports/stock-transfer-report',
  'inventory/reports/sales-commissions-for-representatives',
  'inventory/reports/sales-returns-reports',
  'inventory/reports/purchase-returns-reports',
  'inventory/reports/purchase-reports',
  'inventory/reports/sales-and-purchase-tax',
  'inventory/reports/items-profit-reports',
  'inventory/reports/overdue-payments',
  'inventory/reports/item-movement-reports',
  'inventory/reports/inventory-reports',
  'inventory/reports/customer-receivables',
  'inventory/reports/stock-profit-reports',
  'inventory/reports/receivables-aging',
  'inventory/reports/invoices-profit-reports',
  'inventory/reports/customer-balances',
  'real-estate-investment/reports/customer-followup',
]);

const PREVIEW_SUFFIX = `${path.sep}preview${path.sep}page.tsx`;

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name === 'page.tsx' && full.endsWith(PREVIEW_SUFFIX)) {
      out.push(full);
    }
  }
  return out;
}

function registryPathFromFile(file) {
  const rel = path.relative(APP, file);
  const parts = rel.split(path.sep);
  if (parts.length < 3 || parts[parts.length - 1] !== 'page.tsx') return null;
  if (parts[parts.length - 2] !== 'preview') return null;
  return parts.slice(0, -2).join('/');
}

const content = (registryPath) => `'use client';

import ReportPreviewFromRegistry from '@/components/report/ReportPreviewFromRegistry';

export default function PreviewPage() {
  return <ReportPreviewFromRegistry path="${registryPath}" />;
}
`;

const files = walk(APP);
let n = 0;
for (const file of files) {
  const rp = registryPathFromFile(file);
  if (!rp || SKIP.has(rp)) continue;
  fs.writeFileSync(file, content(rp), 'utf8');
  n++;
}
console.log(`Rewrote ${n} preview pages (skipped ${SKIP.size} custom).`);
