/**
 * Phase 3 — migration pipeline smoke test on sample JSON fixtures.
 * Run: npm run test:migration-pipeline
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const SAMPLE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migration',
  'fixtures',
  'sample'
);

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  console.log('Migration pipeline test — start');

  execSync(`npx tsx scripts/migration/migrate-legacy-data.ts --phase=ALL --company=MIG1`, {
    cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', LEGACY_DATA_PATH: SAMPLE_PATH },
  });

  const company = await prisma.company.findFirst({
    where: { legacyCompanyCode: 'MIG1' },
  });
  assert(!!company, 'Company MIG1 migrated');

  const [accounts, items, journals, invoices, qty, costs] = await Promise.all([
    prisma.account.count({ where: { companyId: company!.id } }),
    prisma.item.count({ where: { companyId: company!.id, serial: 'SKU-001' } }),
    prisma.journalEntry.count({
      where: { companyId: company!.id, legacyGlNum: '00000001' },
    }),
    prisma.invoice.count({
      where: { companyId: company!.id, invoiceNumber: '1001' },
    }),
    prisma.itemQuantity.count({
      where: { item: { companyId: company!.id, serial: 'SKU-001' } },
    }),
    prisma.itemCostHistory.count({ where: { companyId: company!.id } }),
  ]);

  assert(accounts >= 3, 'Accounts imported');
  assert(items >= 1, 'Item imported');
  assert(journals >= 1, 'Journal entry imported with padded legacyGlNum');
  assert(invoices >= 1, 'Invoice imported');
  assert(qty >= 1, 'Item quantity opening balance');
  assert(costs >= 1, 'Item cost history');

  const cash = await prisma.cashTransaction.count({ where: { companyId: company!.id } });
  assert(cash >= 1, 'Cash transaction imported');

  console.log('Re-run idempotency check...');
  const journalBefore = await prisma.journalEntry.count({
    where: { companyId: company!.id, legacyGlNum: '00000001' },
  });

  execSync(`npx tsx scripts/migration/migrate-legacy-data.ts --phase=ALL --company=MIG1`, {
    cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', LEGACY_DATA_PATH: SAMPLE_PATH },
  });

  const journalAfter = await prisma.journalEntry.count({
    where: { companyId: company!.id, legacyGlNum: '00000001' },
  });
  assert(journalBefore >= 1, 'At least one journal from first run');
  assert(journalAfter === journalBefore, 'Journal count unchanged on re-run (idempotent)');

  console.log('Migration pipeline test — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
