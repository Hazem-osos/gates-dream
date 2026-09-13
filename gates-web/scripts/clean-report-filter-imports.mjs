#!/usr/bin/env node
/** Remove unused OuterCard/InnerCard/ErrorToast imports after filter migration */
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

for (const file of walk(APP)) {
  if (!file.includes('reports') && !file.includes('account-reports')) continue;
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const sym of ['OuterCard', 'InnerCard', 'ErrorToast', 'ActionButtons']) {
    const imp = new RegExp(`import[^;]*${sym}[^;]*;\\n?`, 'g');
    if (!src.includes(`<${sym}`) && !src.includes(`${sym}.`) && src.match(imp)) {
      src = src.replace(imp, '');
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, src);
}
console.log('Cleaned unused imports in report pages');
