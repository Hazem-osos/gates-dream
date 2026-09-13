#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = "import type { ApiError } from '@/lib/api/types';\n";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function fix(src) {
  const re = /import \{\nimport type \{ ApiError \} from '@\/lib\/api\/types';\n([\s\S]*?\n)\} from '([^']+)';/g;
  return src.replace(re, (_m, middle, fromPath) => {
    return `import {\n${middle}} from '${fromPath}';\n${API}`;
  });
}

let n = 0;
for (const base of ['app/inventory', 'app/extracts', 'app/contracting']) {
  for (const file of walk(path.join(root, base))) {
    const before = fs.readFileSync(file, 'utf8');
    const after = fix(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      n++;
    }
  }
}
console.log(`fix-api-error-import-blocks: ${n} file(s)`);
