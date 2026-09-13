#!/usr/bin/env node
/**
 * Sets thin registry preview pages to CatalogReportPreviewPage default export.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

const REPLACEMENT = `'use client';

export { default } from '@/components/report/CatalogReportPreviewPage';
`;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (name === 'page.tsx' && full.includes(`${path.sep}preview${path.sep}`)) acc.push(full);
  }
  return acc;
}

const CUSTOM_MARKERS = [
  'min-h-screen bg-[#F6FBFD]',
  'UniversalReportView',
  'ElectronicInvoiceReportPreviewPage',
  'JSON.stringify',
  'SALES_REPORT_COLUMNS',
];

let updated = 0;
let skipped = 0;

for (const file of walk(APP)) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (CUSTOM_MARKERS.some((m) => src.includes(m))) {
    skipped++;
    continue;
  }
  if (src.includes('CatalogReportPreviewPage')) {
    skipped++;
    continue;
  }
  if (!src.includes('ReportPreviewFromRegistry') && !src.includes('UniversalReportViewer')) {
    skipped++;
    continue;
  }
  fs.writeFileSync(file, REPLACEMENT);
  updated++;
}

console.log(`Preview bulk update: ${updated} updated, ${skipped} skipped`);
