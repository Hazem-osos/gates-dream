#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

function balanceLegacyGrid(s) {
  const start = s.indexOf('<ReportFilterLegacyGrid>');
  const end = s.indexOf('</ReportFilterLegacyGrid>');
  if (start === -1 || end === -1) return s;
  const chunk = s.slice(start, end);
  let pad = '';
  for (const tag of ['form', 'section', 'div']) {
    const opens = (chunk.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (chunk.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    const missing = opens - closes;
    if (missing > 0) pad += `            </${tag}>\n`.repeat(missing);
  }
  if (!pad) return s;
  return s.replace('</ReportFilterLegacyGrid>', `${pad}      </ReportFilterLegacyGrid>`);
}

function ensureImport(s) {
  if (!s.includes('<ReportFilterLegacyGrid>')) return s;
  if (/ReportFilterLegacyGrid/.test(s) && s.includes("ReportFilterLegacyGrid } from '@/components/report/reportFilterFields'")) {
    return s;
  }
  if (s.includes("from '@/components/report/reportFilterFields'")) {
    return s.replace(
      /from '@\/components\/report\/reportFilterFields';/,
      "from '@/components/report/reportFilterFields';\nimport { ReportFilterLegacyGrid } from '@/components/report/reportFilterFields';"
    ).replace(
      /import \{ ReportFilterLegacyGrid \} from '@\/components\/report\/reportFilterFields';\nimport \{ ReportFilterLegacyGrid \}/,
      'import { ReportFilterLegacyGrid'
    );
  }
  return s.replace(
    /('use client';?\n)/,
    "$1import { ReportFilterLegacyGrid } from '@/components/report/reportFilterFields';\n"
  );
}

let n = 0;
for (const file of walk(path.join(ROOT, 'app'))) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  s = ensureImport(s);
  s = balanceLegacyGrid(s);
  if (s !== orig) {
    fs.writeFileSync(file, s);
    n++;
  }
}
console.log('balance-legacy-grid:', n);
