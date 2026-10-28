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
} else if (truthy(process.env.GATES_SKIP_PRISMA_MIGRATE)) {
  console.log('GATES_SKIP_PRISMA_MIGRATE=1 — skipping prisma migrate deploy on boot.');
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

/**
 * Runtime: compiled JavaScript from `npm run build` (dist/) when present — no
 * TypeScript transpiling at runtime. Falls back to tsx when dist/ was not built,
 * and GATES_RUNTIME=tsx forces tsx (rollback switch, no rebuild needed).
 */
const distEntry = path.join(root, runWorkers ? 'dist/workers/index.js' : 'dist/index.js');
const srcEntry = path.join(root, runWorkers ? 'src/workers/index.ts' : 'src/index.ts');
const forceTsx = String(process.env.GATES_RUNTIME ?? '').trim().toLowerCase() === 'tsx';
const useDist = !forceTsx && existsSync(distEntry);
const entry = useDist ? distEntry : srcEntry;
if (!existsSync(entry)) {
  console.error(`${entry} is missing from the deploy.`);
  process.exit(1);
}
console.log(
  useDist
    ? `Runtime: node (compiled) — ${path.relative(root, entry)}`
    : `Runtime: tsx — ${path.relative(root, entry)}${forceTsx ? ' (GATES_RUNTIME=tsx)' : ' (dist/ not built)'}`
);

const childEnv = {
  ...process.env,
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    '--max-old-space-size=1024',
    // Stack traces point at src/*.ts lines instead of bundled dist/ lines.
    useDist ? '--enable-source-maps' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim(),
};
/**
 * Cluster mode (API only, compiled runtime only): WEB_CONCURRENCY=N runs N API
 * processes in this one container, sharing its port, CPU cores and volume.
 * This is how the API uses more than one core while gates-backend still has a
 * Railway volume (Railway replicas cannot share a volume). Default 1 = today's
 * single process. Each process opens its own DB pool: set DB_CONNECTION_LIMIT
 * so N × DB_CONNECTION_LIMIT stays well under MySQL max_connections.
 */
const requestedConcurrency = Number.parseInt(process.env.WEB_CONCURRENCY ?? '1', 10);
const concurrency =
  !runWorkers && useDist && Number.isFinite(requestedConcurrency) && requestedConcurrency > 1
    ? Math.min(requestedConcurrency, 16)
    : 1;

if (concurrency > 1) {
  const cluster = (await import('node:cluster')).default;
  cluster.setupPrimary({ exec: entry, execArgv: [] });
  console.log(`Cluster: starting ${concurrency} API processes.`);

  const slotByWorkerId = new Map();
  let stopping = false;
  const restartTimes = [];

  const forkSlot = (slot) => {
    // Slot 1 is the only process that runs singletons (MQTT subscriber, API cron).
    const worker = cluster.fork({ ...childEnv, GATES_CLUSTER_WORKER: String(slot) });
    slotByWorkerId.set(worker.id, slot);
  };
  for (let slot = 1; slot <= concurrency; slot += 1) forkSlot(slot);

  cluster.on('exit', (worker, code, signal) => {
    const slot = slotByWorkerId.get(worker.id);
    slotByWorkerId.delete(worker.id);
    if (stopping) {
      if (slotByWorkerId.size === 0) process.exit(0);
      return;
    }
    // Crash loop guard: more than 10 restarts in a minute → exit and let Railway restart us.
    const now = Date.now();
    restartTimes.push(now);
    while (restartTimes.length && now - restartTimes[0] > 60_000) restartTimes.shift();
    if (restartTimes.length > 10) {
      console.error('Cluster: API processes keep crashing — exiting so the platform restarts the service.');
      process.exit(1);
    }
    console.error(`Cluster: process ${slot} exited (code ${code}, signal ${signal}) — restarting.`);
    setTimeout(() => forkSlot(slot), 1_000);
  });

  const stopAll = (signal) => {
    if (stopping) return;
    stopping = true;
    for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill(signal);
    // Same 8 s ceiling as the single-process path below.
    setTimeout(() => process.exit(0), 8_000).unref();
  };
  process.on('SIGTERM', () => stopAll('SIGTERM'));
  process.on('SIGINT', () => stopAll('SIGINT'));
} else {
  startSingleProcess();
}

function startSingleProcess() {
const tsxBin = path.join(root, 'node_modules/.bin/tsx');
const child = useDist
  ? spawn(process.execPath, [entry], { cwd: root, env: childEnv, stdio: 'inherit' })
  : existsSync(tsxBin)
    ? spawn(tsxBin, [entry], { cwd: root, env: childEnv, stdio: 'inherit' })
    : spawn('npx', ['tsx', entry], { cwd: root, env: childEnv, stdio: 'inherit' });

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
}
