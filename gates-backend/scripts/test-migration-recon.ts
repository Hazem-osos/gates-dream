/**
 * Phase 3 — migration reconciliation harness test.
 * Verifies the parity harness passes on a freshly migrated company and, just as importantly,
 * that it fails when the migrated data drifts from the legacy dump.
 * Run: npm run test:migration-recon
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(BACKEND_ROOT, 'scripts', 'migration', 'fixtures');
const SAMPLE_PATH = path.join(FIXTURES, 'sample');
const PROD_LIKE_PATH = path.join(FIXTURES, 'prod-like');
const COMPANY_CODE = 'MIG1';
const PROD_LIKE_COMPANY = 'PRODLIKE';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function run(args: string[], dataPath: string): { status: number; output: string } {
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    env: { ...process.env, LEGACY_DATA_PATH: dataPath },
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function runEtl(company = COMPANY_CODE, dataPath = SAMPLE_PATH) {
  const result = run(
    ['scripts/migration/migrate-legacy-data.ts', '--phase=ALL', `--company=${company}`],
    dataPath
  );
  assert(result.status === 0, `ETL run failed for ${company}: ${result.output.slice(-400)}`);
}

function runRecon(
  company = COMPANY_CODE,
  dataPath = SAMPLE_PATH,
  extra: string[] = []
): { status: number; output: string } {
  return run(
    [
      'scripts/recon/reconcile-migration.ts',
      `--company=${company}`,
      `--data-path=${dataPath}`,
      ...extra,
    ],
    dataPath
  );
}

/**
 * Rehearsal on a production-shaped dump: two fiscal years, three branches sharing GlNum
 * sequences, multi-currency entries, unposted and deleted vouchers, multi-warehouse stock and
 * repeatedly revised costs. This is the closest stand-in for a real extract, and it is where
 * volume-only defects (double-loaded vouchers, report filters dropping accounts) surface.
 */
async function rehearseProdLikeDump() {
  console.log('Prod-like dump rehearsal...');
  const generated = run(['scripts/migration/fixtures/generate-prod-like.ts'], PROD_LIKE_PATH);
  assert(generated.status === 0, `Fixture generation failed: ${generated.output.slice(-400)}`);

  runEtl(PROD_LIKE_COMPANY, PROD_LIKE_PATH);

  const full = runRecon(PROD_LIKE_COMPANY, PROD_LIKE_PATH);
  if (full.status !== 0) console.error(full.output);
  assert(full.status === 0, 'Recon passes on the prod-like dump');

  // A lifetime total can hide offsetting errors; each year must reconcile on its own.
  for (const [from, to] of [
    ['2024-01-01', '2024-12-31'],
    ['2025-01-01', '2025-12-31'],
  ]) {
    const windowed = runRecon(PROD_LIKE_COMPANY, PROD_LIKE_PATH, [
      `--from=${from}`,
      `--to=${to}`,
      '--section=trial-balance',
    ]);
    if (windowed.status !== 0) console.error(windowed.output);
    assert(windowed.status === 0, `Recon passes for window ${from}..${to}`);
  }

  // Re-running the ETL must not double-load: same vouchers, same trial balance.
  runEtl(PROD_LIKE_COMPANY, PROD_LIKE_PATH);
  const afterRerun = runRecon(PROD_LIKE_COMPANY, PROD_LIKE_PATH);
  if (afterRerun.status !== 0) console.error(afterRerun.output);
  assert(afterRerun.status === 0, 'Recon still passes after re-running the ETL (idempotent)');
}

async function main() {
  console.log('Migration recon harness test — start');

  runEtl();

  const clean = runRecon();
  if (clean.status !== 0) console.error(clean.output);
  assert(clean.status === 0, 'Recon passes on freshly migrated fixtures');
  assert(clean.output.includes('trial-balance'), 'Trial balance section reported');
  assert(clean.output.includes('stock'), 'Stock section reported');
  assert(
    clean.output.includes('Migration reconciliation — PASS'),
    'Recon verdict is PASS after a clean migration'
  );

  console.log('Drift detection check...');
  const company = await prisma.company.findFirst({
    where: { legacyCompanyCode: COMPANY_CODE },
    select: { id: true },
  });
  assert(!!company, 'Migrated company exists');

  const qtyRow = await prisma.itemQuantity.findFirst({
    where: { item: { companyId: company!.id } },
    select: { id: true, quantity: true },
  });
  assert(!!qtyRow, 'Migrated stock row to perturb');

  const original = qtyRow!.quantity;
  await prisma.itemQuantity.update({
    where: { id: qtyRow!.id },
    data: { quantity: Number(original) + 5 },
  });
  try {
    const drifted = runRecon();
    assert(drifted.status !== 0, 'Recon exits non-zero when stock drifts');
    assert(
      drifted.output.includes('Migration reconciliation — FAIL'),
      'Recon verdict is FAIL on drift'
    );
    assert(drifted.output.includes('quantity'), 'Drifted metric is reported');
  } finally {
    await prisma.itemQuantity.update({
      where: { id: qtyRow!.id },
      data: { quantity: original },
    });
  }

  const restored = runRecon();
  assert(restored.status === 0, 'Recon passes again after restoring the value');

  await rehearseProdLikeDump();

  console.log('Migration recon harness test — PASSED');
}

main()
  .catch((e) => {
    console.error('Migration recon harness test — FAILED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
