#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

const KEEP = new Set([
  'inventory/reports/sales-reports/preview',
  'electronic-invoices/reports/sales-invoices/preview',
  'electronic-invoices/reports/returns-invoices/preview',
  'electronic-invoices/reports/modified-returns/preview',
]);

const REPLACEMENT = `'use client';

export { default } from '@/components/report/CatalogReportPreviewPage';
`;

const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/reports/report-inventory.json'), 'utf8'));
let n = 0;
for (const e of inv.entries) {
  if (e.kind !== 'preview') continue;
  if (KEEP.has(e.rel)) continue;
  const file = path.join(APP, e.rel, 'page.tsx');
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('CatalogReportPreviewPage') && src.length < 120) continue;
  fs.writeFileSync(file, REPLACEMENT);
  n++;
}
console.log(`Replaced ${n} custom preview pages with CatalogReportPreviewPage`);
