#!/usr/bin/env node
/**
 * Mechanical ESLint fixes for app/accounting and app/taxes (any → typed, ApiError).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const API_ERROR_IMPORT = "import type { ApiError } from '@/lib/api/types';";

function ensureApiErrorImport(src) {
  if (!src.includes('ApiError')) return src;
  if (src.includes("from '@/lib/api/types'") || src.includes('from "@/lib/api/types"')) return src;
  const lines = src.split('\n');
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) insertAt = i + 1;
    else if (insertAt > 0 && !lines[i].startsWith('import ') && lines[i].trim() !== '') break;
  }
  lines.splice(insertAt, 0, API_ERROR_IMPORT);
  return lines.join('\n');
}

function transform(src) {
  let out = src;
  out = out.replace(/useApiMutation<any,\s*any>/g, 'useApiMutation<unknown, Record<string, unknown>>');
  out = out.replace(/useApiMutation<any,\s*Record/g, 'useApiMutation<unknown, Record');
  out = out.replace(/onSuccess:\s*\(\s*data:\s*any\s*\)/g, 'onSuccess: (_data)');
  out = out.replace(/onError:\s*\(\s*error:\s*any\s*\)/g, 'onError: (error: ApiError)');
  out = out.replace(/onError:\s*\(\s*err:\s*any\s*\)/g, 'onError: (error: ApiError)');
  out = out.replace(/catch\s*\(\s*error:\s*any\s*\)/g, 'catch (error: unknown)');
  out = out.replace(/const requestBody:\s*any\s*=/g, 'const requestBody: Record<string, unknown> =');
  out = out.replace(/\(event:\s*any\)/g, '(event: unknown)');
  out = out.replace(/\(e:\s*any\)/g, '(e: unknown)');
  out = ensureApiErrorImport(out);
  // catch (error: unknown) message access
  out = out.replace(
    /catch \(error: unknown\) \{\s*\n(\s*)setError\(error\.message/g,
    'catch (error: unknown) {\n$1setError(error instanceof Error ? error.message'
  );
  return out;
}

for (const base of ['app/accounting', 'app/taxes']) {
  const dir = path.join(root, base);
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after !== before) fs.writeFileSync(file, after);
  }
}

console.log('eslint-fix-accounting-taxes: done');
