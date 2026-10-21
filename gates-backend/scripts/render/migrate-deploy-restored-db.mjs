#!/usr/bin/env node
/**
 * One-off on Render: resolve P3018 for restored dumps until migrate deploy succeeds.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const maxPasses = 48;

function run(args) {
  return spawnSync('npx', args, { cwd: root, env: process.env, encoding: 'utf8' });
}

function migrationNameFromOutput(out) {
  const match = out.match(/Migration name:\s*(\S+)/);
  return match?.[1] ?? null;
}

for (let pass = 1; pass <= maxPasses; pass += 1) {
  const attempt = run(['prisma', 'migrate', 'deploy']);
  const out = `${attempt.stdout ?? ''}\n${attempt.stderr ?? ''}`;
  if (attempt.status === 0) {
    console.log(`migrate deploy succeeded (pass ${pass}).`);
    process.exit(0);
  }
  const name = migrationNameFromOutput(out);
  if (!name) {
    process.stderr.write(out);
    process.exit(attempt.status || 1);
  }
  console.log(`pass ${pass}: resolve --applied ${name}`);
  run(['prisma', 'migrate', 'resolve', '--applied', name]);
}

console.error(`migrate deploy still failing after ${maxPasses} passes.`);
process.exit(1);
