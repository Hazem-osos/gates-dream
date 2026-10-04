/**
 * Lists route handlers that are async and are not passed through asyncHandler.
 * Informational: exits 0 so CI can print the backlog without failing the build.
 * Usage: node scripts/audit-async-routes.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.routes.ts')) out.push(path);
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('asyncHandler')) continue;
  if (/async\s*\(/.test(text) || /async\s+\w+\s*\(/.test(text)) {
    hits.push(file.replace(root, 'src'));
  }
}

console.log(`async route files without asyncHandler: ${hits.length}`);
for (const file of hits.slice(0, 40)) console.log(`  ${file}`);
if (hits.length > 40) console.log(`  … ${hits.length - 40} more`);
