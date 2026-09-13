#!/usr/bin/env node
/** Replace remaining ReportPreviewFromRegistry preview pages with CatalogReportPreviewPage */
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

const SKIP = ['UniversalReportView', 'SALES_REPORT_COLUMNS', 'ElectronicInvoiceReportPreviewPage', 'min-h-screen bg-[#F6FBFD]'];

let n = 0;
for (const file of walk(APP)) {
  const src = fs.readFileSync(file, 'utf8');
  if (SKIP.some((s) => src.includes(s))) continue;
  if (!src.includes('ReportPreviewFromRegistry') && !src.includes('UniversalReportViewer')) continue;
  if (src.includes('CatalogReportPreviewPage')) continue;
  fs.writeFileSync(file, REPLACEMENT);
  n++;
}
console.log(`Updated ${n} preview pages`);
