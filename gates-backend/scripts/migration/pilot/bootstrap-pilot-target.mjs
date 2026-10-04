#!/usr/bin/env node
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

const pilotDb = process.argv[2] ?? 'gates_migration_pilot_phase1';
const sourceDb = process.argv[3] ?? 'gates_db';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');
const u = new URL(url);
const pass = u.password ? decodeURIComponent(u.password) : '';
const host = u.hostname;
const port = u.port || '3306';
const user = decodeURIComponent(u.username);
const auth = pass ? `-p${pass}` : '';

execFileSync('node', ['scripts/migration/pilot/create-fresh-mysql-db.mjs', pilotDb], {
  cwd: root,
  stdio: 'inherit',
});

const sh = `mysqldump -h ${host} -P ${port} -u ${user} ${auth} --no-data --skip-triggers ${sourceDb} | mysql -h ${host} -P ${port} -u ${user} ${auth} ${pilotDb}`;
execFileSync('sh', ['-c', sh], { stdio: 'inherit' });

// Ensure migration-engine tables exist (skip if schema dump already included them)
const pilotUrlForEngine = new URL(url);
pilotUrlForEngine.pathname = `/${pilotDb}`;
try {
  execFileSync(
    'npx',
    ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20261004140000_migration_engine_core/migration.sql'],
    {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: pilotUrlForEngine.toString() },
    }
  );
} catch {
  console.warn('migration_engine_core SQL skipped (tables likely already present from schema dump)');
}

try {
  execFileSync(
    'npx',
    ['prisma', 'db', 'execute', '--file', 'prisma/migrations/20261004195500_legacy_account_override/migration.sql'],
    {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: pilotUrlForEngine.toString() },
    }
  );
} catch {
  console.warn('legacy_account_override SQL skipped (table likely already present from schema dump)');
}

const pilotUrl = new URL(url);
pilotUrl.pathname = `/${pilotDb}`;
console.log('PILOT_DATABASE_URL=' + pilotUrl.toString());
