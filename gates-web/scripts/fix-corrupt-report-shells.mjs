#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [
  'app/inventory/reports',
  'app/accounting/account-reports',
  'app/schools/reports',
  'app/taxes/reports',
  'app/manufacturing/reports',
  'app/real-estate-investment/reports',
  'app/extracts/reports',
  'app/importexport/reports',
  'app/electronic-invoices/reports',
];

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

let n = 0;
for (const rel of dirs) {
  const base = path.join(ROOT, rel);
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    let s = fs.readFileSync(file, 'utf8');
    if (!s.includes('CatalogReportFilterShell')) continue;
    const orig = s;

    s = s.replace(
      /<div className="col-span-full">\s*\n?\s*open=\{showSettings\}[^/]*\/>\s*/g,
      '<ReportFilterLegacyGrid>\n'
    );
    s = s.replace(/<div className=\{``\}>\s*/g, '');
    s = s.replace(/\{\/\* Main Content Container \*\/\}\s*/g, '');
    s = s.replace(/\{\/\* Main Form \*\/\}\s*/g, '');

    if (s.includes('<ReportFilterLegacyGrid>') && !s.includes('</ReportFilterLegacyGrid>')) {
      s = s.replace(/\n(\s*)<\/CatalogReportFilterShell>/, '\n$1</ReportFilterLegacyGrid>\n$1</CatalogReportFilterShell>');
    }

    if (!s.includes('ReportFilterLegacyGrid') && s.includes('<div className="grid')) {
      s = s.replace(
        /(<CatalogReportFilterShell[\s\S]*?>)\s*/,
        "$1\n      <ReportFilterLegacyGrid>\n"
      );
      if (!s.includes('</ReportFilterLegacyGrid>')) {
        s = s.replace(/\n(\s*)<\/CatalogReportFilterShell>/, '\n$1</ReportFilterLegacyGrid>\n$1</CatalogReportFilterShell>');
      }
    }

    if (!s.includes('ReportFilterLegacyGrid') && !s.includes("from '@/components/report/reportFilterFields'")) {
      s = s.replace(
        /('use client';?\n)/,
        "$1import { ReportFilterLegacyGrid } from '@/components/report/reportFilterFields';\n"
      );
    } else if (s.includes('ReportFilterLegacyGrid') && !/ReportFilterLegacyGrid/.test(s.split('reportFilterFields')[0] || '')) {
      s = s.replace(
        /from '@\/components\/report\/reportFilterFields';/,
        "from '@/components/report/reportFilterFields';\nimport { ReportFilterLegacyGrid } from '@/components/report/reportFilterFields';"
      );
      s = s.replace(
        /import \{ ReportFilterLegacyGrid \} from '@\/components\/report\/reportFilterFields';\nimport \{ ReportFilterLegacyGrid \}/,
        'import { ReportFilterLegacyGrid'
      );
    }

    if (s !== orig) {
      fs.writeFileSync(file, s);
      n++;
    }
  }
}
console.log('fix-corrupt-shells:', n);
