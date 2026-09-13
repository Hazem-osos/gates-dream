#!/usr/bin/env node
/**
 * Injects useBackendReachability() into page.tsx files that are not yet using API hooks.
 * Run from gates-web: node scripts/inject-backend-reachability.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..', 'app');

const IMPORT_LINE = `import { useBackendReachability } from '@/lib/hooks/useBackendReachability';`;

function listUnwiredPages() {
  const out = execSync(
    `comm -23 <(find "${appDir}" -name 'page.tsx' | sort) <(grep -rlE 'useApiQuery|useApiMutation|apiClient|useBackendReachability' "${appDir}" --include='page.tsx' | sort)`,
    { shell: '/bin/bash', encoding: 'utf8' }
  );
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function inject(content) {
  if (content.includes('useBackendReachability')) {
    return { content, changed: false };
  }

  let next = content;

  const hasUseClient = /^['"]use client['"];/m.test(next);
  if (!hasUseClient) {
    next = `'use client';\n${next}`;
  }

  if (!next.includes('useBackendReachability')) {
    const firstNl = next.indexOf('\n');
    if (firstNl === -1) {
      next = `${IMPORT_LINE}\n${next}`;
    } else {
      next = `${next.slice(0, firstNl + 1)}${IMPORT_LINE}\n${next.slice(firstNl + 1)}`;
    }
  }

  // Insert hook as first statement in default export function body
  const fnMatch = next.match(/export default function\s+(\w+)\s*\([^)]*\)\s*\{/);
  if (!fnMatch) {
    console.warn('SKIP (no default function match):');
    return { content, changed: false, skip: true };
  }

  const insertAt = fnMatch.index + fnMatch[0].length;
  const before = next.slice(0, insertAt);
  const after = next.slice(insertAt);
  next = `${before}\n  useBackendReachability();\n${after}`;

  return { content: next, changed: true };
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const files = listUnwiredPages();
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { content, changed, skip } = inject(raw);
    if (skip) {
      skipped++;
      console.warn(file);
      continue;
    }
    if (changed && !dry) {
      fs.writeFileSync(file, content, 'utf8');
    }
    if (changed) updated++;
  }

  console.log(
    JSON.stringify(
      {
        scanned: files.length,
        updated,
        skipped,
        dryRun: dry,
      },
      null,
      2
    )
  );
}

main();
