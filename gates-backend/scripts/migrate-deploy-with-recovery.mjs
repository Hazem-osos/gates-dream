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

function runVoRepairSql() {
  const repairPath = path.join(root, 'scripts/repair-vo-partial-migration.sql');
  console.log('Applying idempotent VO migration repair SQL…');
  return run('npx', ['prisma', 'db', 'execute', '--file', repairPath], { allowFail: true });
}

function recoverFromFailedOutput(out) {
  if (out.includes('20261004230000_contract_variation_orders')) {
    runVoRepairSql();
    migrateResolve('applied', '20261004230000_contract_variation_orders');
  }
  if (out.includes('20260924170000_whatsapp_embedded_signup')) {
    migrateResolve('rolled-back', '20260924170000_whatsapp_embedded_signup');
  }
}

export function runMigrateDeployWithRecovery() {
  let attempt = migrateDeploy();
  if (attempt.ok) {
    console.log('prisma migrate deploy succeeded.');
    return 0;
  }

  console.log('migrate deploy failed — running recovery…');
  recoverFromFailedOutput(attempt.out);

  attempt = migrateDeploy();
  if (attempt.ok) {
    console.log('prisma migrate deploy succeeded after recovery.');
    return 0;
  }

  if (attempt.out.includes('P3009') || attempt.out.includes('failed migrations')) {
    recoverFromFailedOutput(attempt.out);
    attempt = migrateDeploy();
    if (attempt.ok) return 0;
  }

  process.stderr.write(attempt.out);
  return attempt.status || 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runMigrateDeployWithRecovery());
}
