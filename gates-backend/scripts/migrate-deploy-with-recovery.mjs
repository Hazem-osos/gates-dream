/**
 * Production-safe prisma migrate deploy with recovery for known failed migrations.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status !== 0 && !allowFail) {
    process.stderr.write(out);
  }
  return { ok: result.status === 0, out, status: result.status ?? 1 };
}

function migrateResolve(action, migrationName) {
  console.log(`migrate resolve --${action} ${migrationName}`);
  return run('npx', ['prisma', 'migrate', 'resolve', `--${action}`, migrationName], {
    allowFail: true,
  });
}

function migrateDeploy() {
  return run('npx', ['prisma', 'migrate', 'deploy'], { allowFail: true });
}

function isTooManyConnections(out) {
  return /too many connections/i.test(out);
}

function sleepSync(ms) {
  spawnSync('sleep', [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: 'ignore' });
}

function migrateDeployWithConnectionRetry() {
  const delaysMs = [4_000, 10_000, 20_000, 30_000];
  let attempt = migrateDeploy();
  for (const delay of delaysMs) {
    if (attempt.ok || !isTooManyConnections(attempt.out)) return attempt;
    console.log(
      `migrate deploy: MySQL too many connections — waiting ${delay / 1000}s then retrying…`
    );
    sleepSync(delay);
    attempt = migrateDeploy();
  }
  return attempt;
}

function runVoRepairSql() {
  const repairPath = path.join(root, 'scripts/repair-vo-partial-migration.sql');
  console.log('Applying idempotent VO migration repair SQL…');
  return run('npx', ['prisma', 'db', 'execute', '--file', repairPath], { allowFail: true });
}

function clearStuckPrismaMigrationRows() {
  const repairPath = path.join(root, 'scripts/clear-stuck-prisma-migrations.sql');
  console.log('Clearing stuck _prisma_migrations rows (finished_at IS NULL)…');
  return run('npx', ['prisma', 'db', 'execute', '--file', repairPath], { allowFail: true });
}

function migrationNameFromP3018(out) {
  const match = out.match(/Migration name:\s*(\S+)/);
  return match?.[1] ?? null;
}

function recoverFromFailedOutput(out) {
  if (out.includes('20261004230000_contract_variation_orders')) {
    runVoRepairSql();
    migrateResolve('applied', '20261004230000_contract_variation_orders');
  }
  if (out.includes('20260924170000_whatsapp_embedded_signup')) {
    migrateResolve('rolled-back', '20260924170000_whatsapp_embedded_signup');
  }
  if (out.includes('P3009') || out.includes('failed migrations')) {
    // Restored DBs often have a stale row with finished_at IS NULL from a crashed deploy.
    // Do not blanket rolled-back on named migrations — that can rewind a healthy schema.
    clearStuckPrismaMigrationRows();
  }
  if (out.includes('P3018')) {
    const repairPath = path.join(root, 'scripts/render/fix-prisma-migration-table.sql');
    console.log('Applying migration table repair SQL after P3018…');
    run('npx', ['prisma', 'db', 'execute', '--file', repairPath], { allowFail: true });
    const failedName = migrationNameFromP3018(out);
    if (failedName) {
      migrateResolve('applied', failedName);
    }
    clearStuckPrismaMigrationRows();
  }
}

export function runMigrateDeployWithRecovery() {
  const maxRecoveryPasses = 12;
  let attempt = migrateDeployWithConnectionRetry();
  if (attempt.ok) {
    console.log('prisma migrate deploy succeeded.');
    return 0;
  }

  if (isTooManyConnections(attempt.out)) {
    process.stderr.write(attempt.out);
    return attempt.status || 1;
  }

  for (let pass = 0; pass < maxRecoveryPasses; pass += 1) {
    console.log(`migrate deploy failed — running recovery (pass ${pass + 1}/${maxRecoveryPasses})…`);
    recoverFromFailedOutput(attempt.out);
    attempt = migrateDeployWithConnectionRetry();
    if (attempt.ok) {
      console.log(`prisma migrate deploy succeeded after recovery pass ${pass + 1}.`);
      return 0;
    }
    if (isTooManyConnections(attempt.out)) {
      process.stderr.write(attempt.out);
      return attempt.status || 1;
    }
    const recoverable =
      attempt.out.includes('P3009') ||
      attempt.out.includes('failed migrations') ||
      attempt.out.includes('P3018');
    if (!recoverable) break;
  }

  process.stderr.write(attempt.out);
  return attempt.status || 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runMigrateDeployWithRecovery());
}
