#!/usr/bin/env node
/** Repairs common JSX damage from legacy cleanup scripts */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ROOTS = [
  'app/inventory/reports',
  'app/accounting/account-reports',
  'app/schools/reports',
  'app/taxes/reports',
  'app/manufacturing/reports',
  'app/real-estate-investment/reports',
  'app/extracts/reports',
  'app/electronic-invoices/reports',
  'app/importexport/reports',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'page.tsx') out.push(p);
  }
  return out;
}

function repair(src) {
  let s = src;
  s = s.replace(/reportFilterInputClass;\s*return/g, 'reportFilterInputClass;\n\n  return');
  s = s.replace(/<div className="col-span-full">\s*<\/div>\s*/g, '');
  s = s.replace(/\{\/\*\s*Header[^*]*\*\/\}\s*/g, '');
  s = s.replace(
    /<div className=\`\$\{showSettings[^`]+\}\`\s*>\s*\{\/\*\s*Main Form\s*\*\/\}\s*/g,
    ''
  );
  s = s.replace(/<div className=\`\$\{showSettings[^`]+\}\`\s*>\s*/g, '');
  s = s.replace(/\{\/\*\s*Footer Actions\s*\*\/\}[\s\S]*?<\/div>\s*(?=<\/CatalogReportFilterShell>)/g, '');
  s = s.replace(/\{\/\*\s*Action Buttons\s*\*\/\}[\s\S]*?<\/div>\s*/g, '');
  s = s.replace(
    /<button[\s\S]*?>\s*إغلاق\s*<\/button>\s*/g,
    ''
  );
  s = s.replace(
    /<button[\s\S]*?>\s*معاينة\s*<\/button>\s*/g,
    (b) => (b.includes('handlePreview') && b.includes('CatalogReportFilterShell') ? '' : b)
  );
  // Remove orphan closing divs before shell end (up to 3)
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\s*<\/div>\s*\n(\s*<\/CatalogReportFilterShell>)/, '\n$1');
  }
  return s === src ? null : s;
}

let n = 0;
for (const rel of ROOTS) {
  for (const file of walk(path.join(ROOT, rel))) {
    const src = fs.readFileSync(file, 'utf8');
    const next = repair(src);
    if (next) {
      fs.writeFileSync(file, next);
      n++;
    }
  }
}
console.log(`repair-report-filter-jsx: ${n} files`);

try {
  execSync('npx tsc --noEmit 2>&1 | rg "reports/" | wc -l', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (e) {
  console.log('remaining tsc report errors:', String(e.stdout || e.stderr || '').trim());
}
