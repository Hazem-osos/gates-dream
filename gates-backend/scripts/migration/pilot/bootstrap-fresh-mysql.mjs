#!/usr/bin/env node
/**
 * Disposable local MySQL for migration-engine pilot.
 *
 * Prisma migration history has legacy ordering gaps; a full `migrate deploy`
 * from empty is being repaired via `20250815120000_prisma_baseline_schema`.
 * Until that repair completes, this bootstrap uses `prisma db push` to materialize
 * the current schema (including migration_engine tables), then verifies the DB
 * matches `schema.prisma`.
 */
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

const dbName = process.argv[2] ?? 'gates_migration_pilot_fresh';
execFileSync('node', ['scripts/migration/pilot/create-fresh-mysql-db.mjs', dbName], {
  cwd: root,
  stdio: 'inherit',
});

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const pilotUrl = new URL(url);
pilotUrl.pathname = `/${dbName}`;
process.env.DATABASE_URL = pilotUrl.toString();

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

const diff = execFileSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-url',
    pilotUrl.toString(),
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { cwd: root, encoding: 'utf8', env: process.env }
);
if (diff.trim() && !diff.includes('-- This is an empty migration')) {
  console.error('Schema drift after db push:\n', diff.slice(0, 2000));
  process.exit(1);
}
console.log('BOOTSTRAP_OK', pilotUrl.toString().replace(/:([^:@/]+)@/, ':***@'));
