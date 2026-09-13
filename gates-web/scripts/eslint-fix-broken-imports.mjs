#!/usr/bin/env node
/** Fix ApiError import inserted inside multi-line import blocks. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = "import type { ApiError } from '@/lib/api/types';\n";

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function fixCatch(src) {
  return src.replace(
    /setError\(error instanceof Error \? error\.message \|\| '([^']*)'\);/g,
    "setError(error instanceof Error ? error.message : '$1');"
  );
}

function fixBrokenImport(src) {
  const broken = /import \{\nimport type \{ ApiError \} from '@\/lib\/api\/types';\n([\s\S]*?\n)\} from/g;
  if (!broken.test(src)) return src;
  return src.replace(broken, (m, middle) => {
    return `import {\n${middle}} from`;
  }).replace(/(from '@\/lib\/validation\/accounting\.schema';)/, `${API}$1`);
}

function fixOnSuccessUnderscore(src) {
  return src.replace(/onSuccess: \(_data\) =>/g, 'onSuccess: () =>');
}

for (const base of ['app/accounting', 'app/taxes']) {
  for (const file of walk(path.join(root, base))) {
    let src = fs.readFileSync(file, 'utf8');
    const next = fixOnSuccessUnderscore(fixCatch(fixBrokenImport(src)));
    if (next !== src) fs.writeFileSync(file, next);
  }
}

console.log('fix-imports: done');
