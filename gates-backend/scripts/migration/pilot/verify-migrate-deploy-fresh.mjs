#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dbName = process.argv[2] ?? 'gates_migration_pilot_fresh';
const url = execFileSync('node', ['scripts/migration/pilot/create-fresh-mysql-db.mjs', dbName], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .pop();

try {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  console.log('MIGRATE_DEPLOY_FRESH_OK');
} catch (e) {
  console.error('MIGRATE_DEPLOY_FRESH_FAILED');
  process.exit(1);
}
