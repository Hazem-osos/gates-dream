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

let n = 0;
for (const file of walk(path.join(ROOT, 'app'))) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;

  s = s.replace(
    /onClearError=\{\(\) =>\s*\n?\s*<ReportFilterLegacyGrid>\s*\n?\s*setError\(''\)\}\s*\n?\s*>/g,
    "onClearError={() => setError('')}\n    >\n      <ReportFilterLegacyGrid>"
  );

  s = s.replace(
    /onPreview=\{handlePreview\}\s*\n?\s*error=\{error\}\s*\n?\s*onClearError=\{\(\) =>\s*\n?\s*<ReportFilterLegacyGrid>/g,
    'onPreview={handlePreview}\n      error={error}\n      onClearError={() => setError(\'\')}\n    >\n      <ReportFilterLegacyGrid>'
  );

  // Stray fragment: setError('')} alone
  s = s.replace(/\n\s*setError\(''\)\}\s*\n\s*>/g, "\n    >");

  if (s !== orig) {
    fs.writeFileSync(file, s);
    n++;
  }
}
console.log('fix-onClearError:', n);
