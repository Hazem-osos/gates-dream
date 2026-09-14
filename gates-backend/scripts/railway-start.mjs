import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['prisma', 'generate']);
run('npx', ['prisma', 'migrate', 'deploy']);

if (truthy(process.env.SEED_ON_BOOT)) {
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

const entry = path.join(root, 'src/index.ts');
if (!existsSync(entry)) {
  console.error('src/index.ts is missing from the deploy.');
  process.exit(1);
}

const child = spawn('npx', ['tsx', entry], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
