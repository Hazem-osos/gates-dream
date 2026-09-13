#!/usr/bin/env node
/**
 * run-gap-report.mjs — execute the five-step legacy parity gap pipeline.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  'build-legacy-screens.mjs',
  'extract-save-behavior.mjs',
  'extract-web-screens.mjs',
  'map-legacy-web-routes.mjs',
  'build-gap-report.mjs',
];

for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const result = spawnSync(process.execPath, [path.join(dir, step)], {
    stdio: 'inherit',
    cwd: path.resolve(dir, '../..'),
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
