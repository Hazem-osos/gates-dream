#!/usr/bin/env node
/**
 * Fast audit: flag route handlers that look like async without try/catch or next(err).
 * Scans src/modules (routes and controllers folders).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|js)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

const targets = [
  ...walk(path.join(root, 'modules')).filter((f) => /[/\\]routes[/\\]/.test(f)),
  ...walk(path.join(root, 'modules')).filter((f) => /[/\\]controllers[/\\]/.test(f)),
];

const findings = [];

for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(root, '..'), file);

  // Express-style: router.get/post(..., async (req, res) => { ... })
  const asyncHandlerRe =
    /(?:router\.\w+|app\.\w+)\([^)]*,\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = asyncHandlerRe.exec(src)) !== null) {
    const body = m[1];
    if (!/\btry\s*\{/.test(body) && !/\bcatch\s*\(/.test(body)) {
      if (!/\bnext\s*\(/.test(body) && !/asyncHandler\s*\(/.test(body)) {
        findings.push({ file: rel, issue: 'async route callback without try/catch or next(err)' });
      }
    }
  }

  // Class methods: async foo(req, res) { ... }
  const methodRe = /async\s+(\w+)\s*\([^)]*req[^)]*res[^)]*\)\s*\{([\s\S]*?)\n\s*\}/g;
  while ((m = methodRe.exec(src)) !== null) {
    const name = m[1];
    const body = m[2];
    if (body.length > 8000) continue;
    if (!/\btry\s*\{/.test(body) && !/\bcatch\s*\(/.test(body) && !/\bnext\s*\(/.test(body)) {
      findings.push({ file: rel, issue: `async method "${name}" without try/catch or next(err)` });
    }
  }
}

if (findings.length === 0) {
  console.log('audit-async-routes: no naked async handlers flagged.');
  process.exit(0);
}

console.log(`audit-async-routes: ${findings.length} finding(s):\n`);
for (const f of findings.slice(0, 80)) {
  console.log(`  ${f.file}\n    → ${f.issue}`);
}
if (findings.length > 80) console.log(`  … and ${findings.length - 80} more`);
process.exit(1);
