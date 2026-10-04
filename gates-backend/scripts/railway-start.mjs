import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrateDeployWithRecovery } from './migrate-deploy-with-recovery.mjs';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function truthy(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  if (process.env.MYSQL_URL?.trim()) return process.env.MYSQL_URL.trim();
  const host = process.env.MYSQLHOST || process.env.MYSQL_HOST;
  if (!host) {
    throw new Error(
      'DATABASE_URL is missing. Attach Railway MySQL and map DATABASE_URL=${{MySQL.MYSQL_URL}}.'
    );
  }
  const user = encodeURIComponent(process.env.MYSQLUSER || process.env.MYSQL_USER || 'root');
  const pass = encodeURIComponent(process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '');
  const port = process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306';
  const db = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway';
  return `mysql://${user}:${pass}@${host}:${port}/${db}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.PRISMA_HIDE_UPDATE_MESSAGE = process.env.PRISMA_HIDE_UPDATE_MESSAGE || '1';

function run(command, args) {
  const status = runAllowFail(command, args);
  if (status !== 0) process.exit(status ?? 1);
}

function runAllowFail(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

const runWorkers = truthy(process.env.GATES_RUN_WORKERS);

const prismaClientReady =
  existsSync(path.join(root, 'node_modules/.prisma/client/index.js')) ||
  existsSync(path.join(root, 'node_modules/@prisma/client/index.js'));
if (prismaClientReady) {
  console.log('Prisma client already generated — skipping generate on boot.');
} else {
  run('npx', ['prisma', 'generate']);
}

if (runWorkers) {
  console.log('GATES_RUN_WORKERS=1 — starting the worker process, skipping migrate and seed.');
} else {
  const migrated = runMigrateDeployWithRecovery();
  if (migrated !== 0) process.exit(migrated);
}

if (!runWorkers && truthy(process.env.SEED_ON_BOOT)) {
  const prod = process.env.NODE_ENV === 'production';
  if (prod && !truthy(process.env.ALLOW_PROD_SEED)) {
    console.warn('SEED_ON_BOOT ignored in production — ALLOW_PROD_SEED is not set.');
  } else {
    if (!process.env.SEED_OWNER_PASSWORD) {
      console.error('SEED_ON_BOOT=true requires SEED_OWNER_PASSWORD so testers can log in.');
      process.exit(1);
    }
    if (prod) process.env.ALLOW_PROD_SEED = process.env.ALLOW_PROD_SEED || 'true';
    run('npx', ['tsx', 'prisma/seed.ts']);
  }
}

const entry = path.join(root, runWorkers ? 'src/workers/index.ts' : 'src/index.ts');
if (!existsSync(entry)) {
  console.error(`${entry} is missing from the deploy.`);
  process.exit(1);
}

const tsxBin = path.join(root, 'node_modules/.bin/tsx');
const child = existsSync(tsxBin)
  ? spawn(tsxBin, [entry], { cwd: root, env: process.env, stdio: 'inherit' })
  : spawn('npx', ['tsx', entry], { cwd: root, env: process.env, stdio: 'inherit' });

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) child.kill(signal);
  const force = setTimeout(() => process.exit(0), 8_000);
  force.unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
  if (shuttingDown || signal === 'SIGTERM' || signal === 'SIGINT') {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
