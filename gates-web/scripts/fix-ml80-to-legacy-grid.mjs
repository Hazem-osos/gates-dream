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

function fix(s) {
  if (!s.includes('CatalogReportFilterShell')) return s;
  let n = s;
  if (n.includes('ml-80') && !n.includes('<ReportFilterLegacyGrid>')) {
    n = n.replace(
      /<div className=\`\$\{showSettings \? 'ml-80' : ''\}\`\s*>\s*\{\/\* Form Fields \*\/\}\s*/g,
      '<ReportFilterLegacyGrid>\n'
    );
    n = n.replace(
      /<div className=\`transition-all duration-300 \$\{showSettings \? 'ml-80' : ''\}\`\s*>\s*\{\/\* Form Fields \*\/\}\s*/g,
      '<ReportFilterLegacyGrid>\n'
    );
    n = n.replace(
      /<div className=\`\$\{showSettings \? 'ml-80' : ''\}\`\s*>\s*/g,
      '<ReportFilterLegacyGrid>\n'
    );
    n = n.replace(
      /<div className="transition-all duration-\d+ \$\{showSettings \? 'ml-80' : ''\}">\s*/g,
      '<ReportFilterLegacyGrid>\n'
    );
  }
  if (n.includes('<ReportFilterLegacyGrid>') && !n.includes('</ReportFilterLegacyGrid>')) {
    n = n.replace(/\n(\s*)<\/CatalogReportFilterShell>/, '\n$1</ReportFilterLegacyGrid>\n$1</CatalogReportFilterShell>');
  }
  return n;
}

let c = 0;
for (const file of walk(path.join(ROOT, 'app'))) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  const src = fs.readFileSync(file, 'utf8');
  const next = fix(src);
  if (next !== src) {
    fs.writeFileSync(file, next);
    c++;
  }
}
console.log('fix-ml80-grid:', c);
