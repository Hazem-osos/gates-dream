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
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  s = s.replace(
    /<ReportFilterLegacyGrid>\s*\nsetError\(''\)\}\s*\n(?:\s*settingsOpen=\{[^}]+\}\s*\n\s*onSettingsOpenChange=\{[^}]+\}\s*\n)?\s*>/g,
    '<ReportFilterLegacyGrid>\n'
  );
  s = s.replace(/<ReportFilterLegacyGrid>\s*\nsetError\(''\)\}\s*\n/g, '<ReportFilterLegacyGrid>\n');
  if (s !== orig) {
    fs.writeFileSync(file, s);
    n++;
  }
}
console.log('fix-stray-setError:', n);
