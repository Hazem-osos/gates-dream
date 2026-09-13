#!/usr/bin/env node
/**
 * Scan 'use client' files for localStorage/sessionStorage/window/document
 * at module top-level or inside component body outside useEffect/useLayoutEvent handlers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const STORAGE_RE = /\b(localStorage|sessionStorage|window\.|document\.)/;

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function auditFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes("'use client'") && !src.includes('"use client"')) return [];

  const lines = src.split('\n');
  const issues = [];
  let inUseEffect = 0;
  let inUseLayoutEffect = 0;
  let inFunctionComponent = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^export default function|^function \w+|^const \w+ = \(\) =>|^const \w+ = function/.test(trimmed)) {
      inFunctionComponent = true;
      braceDepth = 0;
    }

    if (trimmed.includes('useEffect(') || trimmed.startsWith('useEffect(')) inUseEffect++;
    if (trimmed.includes('useLayoutEffect(')) inUseLayoutEffect++;

    if (STORAGE_RE.test(line) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      const inHook = inUseEffect > 0 || inUseLayoutEffect > 0;
      const isTypeGuard = trimmed.includes('typeof window') || trimmed.includes('typeof document');
      if (!inHook && !isTypeGuard && inFunctionComponent) {
        issues.push({ line: i + 1, text: trimmed.slice(0, 120) });
      }
    }

    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;

    if (trimmed === '});' || trimmed === '}, []);' || trimmed.startsWith('}, [')) {
      if (inUseEffect > 0) inUseEffect--;
      if (inUseLayoutEffect > 0) inUseLayoutEffect--;
    }
  }

  return issues.map((iss) => ({ file: path.relative(root, file), ...iss }));
}

const dirs = ['app', 'components', 'lib'];
const all = [];
for (const d of dirs) {
  const abs = path.join(root, d);
  if (fs.existsSync(abs)) {
    for (const f of walk(abs)) all.push(...auditFile(f));
  }
}

if (all.length === 0) {
  console.log('audit-client-storage: no risky storage access in client render paths (heuristic).');
  process.exit(0);
}

console.log(`audit-client-storage: ${all.length} potential issue(s):\n`);
for (const row of all.slice(0, 50)) {
  console.log(`  ${row.file}:${row.line}  ${row.text}`);
}
if (all.length > 50) console.log(`  … and ${all.length - 50} more`);
process.exit(1);
