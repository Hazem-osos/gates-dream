#!/usr/bin/env node
/**
 * Mechanical ESLint fixes for inventory, extracts, contracting (Sprint 2).
 * Inserts ApiError import after the last consecutive import line — never inside a block.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_ERROR_IMPORT = "import type { ApiError } from '@/lib/api/types';";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx?)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function insertApiErrorImport(src) {
  if (!src.includes('ApiError')) return src;
  if (src.includes("from '@/lib/api/types'") || src.includes('from "@/lib/api/types"')) return src;
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('import ') || (lastImport >= 0 && (t.startsWith('} from ') || t === '}'))) {
      if (t.startsWith('import ') || t.startsWith('} from ')) lastImport = i;
    } else if (lastImport >= 0 && t !== '' && !t.startsWith('//')) break;
  }
  if (lastImport < 0) return src;
  lines.splice(lastImport + 1, 0, API_ERROR_IMPORT);
  return lines.join('\n');
}

function transform(src) {
  let out = src;
  out = out.replace(/useApiMutation<any,\s*any>/g, 'useApiMutation<unknown, Record<string, unknown>>');
  out = out.replace(/useApiMutation<any,\s*Record/g, 'useApiMutation<unknown, Record');
  out = out.replace(/useOptimisticApiMutation<any,\s*any>/g, 'useOptimisticApiMutation<unknown, Record<string, unknown>>');
  out = out.replace(/useOptimisticApiMutation<any,\s*Record/g, 'useOptimisticApiMutation<unknown, Record');
  out = out.replace(/onSuccess:\s*\(\s*data:\s*any\s*\)/g, 'onSuccess: ()');
  out = out.replace(/onSuccess:\s*\(\s*_data\s*\)/g, 'onSuccess: ()');
  out = out.replace(/onError:\s*\(\s*error:\s*any\s*\)/g, 'onError: (error: ApiError)');
  out = out.replace(/onError:\s*\(\s*err:\s*any\s*\)/g, 'onError: (error: ApiError)');
  out = out.replace(/onError:\s*\(\s*err:\s*ApiError\s*\)/g, 'onError: (error: ApiError)');
  out = out.replace(/catch\s*\(\s*error:\s*any\s*\)/g, 'catch (error: unknown)');
  out = out.replace(/catch\s*\(\s*e:\s*any\s*\)/g, 'catch (e: unknown)');
  out = out.replace(/catch\s*\(\s*err:\s*any\s*\)/g, 'catch (err: unknown)');
  out = out.replace(/const requestBody:\s*any\s*=/g, 'const requestBody: Record<string, unknown> =');
  out = out.replace(/:\s*any\[\]/g, ': unknown[]');
  out = out.replace(/\(row:\s*any\)/g, '(row: Record<string, unknown>)');
  out = out.replace(/\(item:\s*any\)/g, '(item: Record<string, unknown>)');
  out = out.replace(/\(line:\s*any\)/g, '(line: Record<string, unknown>)');
  if (out.includes('ApiError')) out = insertApiErrorImport(out);
  // Fix broken onError bodies that reference wrong identifier after err→error rename
  out = out.replace(/onError: \(error: ApiError\) => \{\s*\n(\s*)setError\(err\./g, 'onError: (error: ApiError) => {\n$1setError(error.');
  return out;
}

for (const base of ['app/inventory', 'app/extracts', 'app/contracting']) {
  const dir = path.join(root, base);
  for (const file of walk(dir)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after !== before) fs.writeFileSync(file, after);
  }
}

console.log('eslint-fix-inventory-extracts: done');
