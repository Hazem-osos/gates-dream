#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../app');

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (name === 'page.tsx') acc.push(full);
  }
  return acc;
}

let fixed = 0;
for (const file of walk(APP)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('<CatalogReportFilterShell')) continue;
  if (src.includes('</CatalogReportFilterShell>')) continue;

  src = src.replace(/\bonClick=\{handleCancel\}/g, 'onClick={() => {}}');
  src = src.replace(/\n\s*const handleCancel[\s\S]*?\n\s*};\n/g, '\n');

  src = src.replace(
    /(\n\s*)<\/div>\s*\n(\s*)\);\s*\n\}/,
    '$1</div>\n$2</CatalogReportFilterShell>\n$2);\n}'
  );

  if (!src.includes('</CatalogReportFilterShell>')) {
    src = src.replace(/(\n\s*)\);\s*\n\}\s*$/, '$1</CatalogReportFilterShell>\n$1);\n}\n');
  }

  src = src.replace(
    /\{error && <ErrorToast message=\{error\} onClose=\{\(\) => setError\(''\)\} \/>\}/g,
    ''
  );

  fs.writeFileSync(file, src);
  fixed++;
}
console.log(`Fixed closing tags on ${fixed} files`);
