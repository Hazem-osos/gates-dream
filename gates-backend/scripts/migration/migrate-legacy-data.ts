#!/usr/bin/env tsx
/**
 * Legacy SQL Server / JSON dump → Prisma (MySQL) ETL CLI.
 *
 * Usage:
 *   npm run migrate:legacy -- --phase=ALL --company=0001
 *   npm run migrate:legacy -- --dry-run --phase=A --data-path=./scripts/migration/fixtures/sample
 */
import { PrismaClient } from '@prisma/client';
import { LegacyDataExtractor } from './LegacyDataExtractor';
import { LegacyIdCache } from './legacy-id-cache';
import { parseMigrationArgs } from './types';
import { appendMigrationError } from './utils/migration-logger';
import { runPhaseA } from './phases/phase-a-masters';
import { runPhaseB } from './phases/phase-b-openings';
import { runPhaseC } from './phases/phase-c-transactions';
import { runPhaseD } from './phases/phase-d-parties-cheques';

async function main() {
  const options = parseMigrationArgs(process.argv.slice(2));
  console.log('Legacy migration CLI');
  console.log(JSON.stringify(options, null, 2));
  if (options.dryRun) console.log('*** DRY RUN — no database writes ***');

  const prisma = new PrismaClient();
  const extractor = new LegacyDataExtractor(options.dataPath, options.mssqlUrl);
  const cache = new LegacyIdCache();

  const ctx = {
    prisma,
    extractor,
    cache,
    options,
    stats: [],
    logError: (phase: string, table: string, row: Record<string, unknown>, error: unknown) => {
      void appendMigrationError(phase, table, row, error);
    },
  };

  try {
    const runA = options.phase === 'A' || options.phase === 'ALL';
    const runB = options.phase === 'B' || options.phase === 'ALL';
    const runC = options.phase === 'C' || options.phase === 'ALL';
    const runD = options.phase === 'D' || options.phase === 'ALL';

    if (runA) await runPhaseA(ctx);
    if (runB) await runPhaseB(ctx);
    if (runC) await runPhaseC(ctx);
    if (runD) await runPhaseD(ctx);

    console.log('\n=== Migration summary ===');
    for (const s of ctx.stats) {
      console.log(
        `${s.table}: read=${s.read} upserted=${s.upserted} skipped=${s.skipped} failed=${s.failed}`
      );
    }
    const totalFailed = ctx.stats.reduce((n, s) => n + s.failed, 0);
    if (totalFailed > 0) {
      console.log(`\nSee docs/migration/migration-errors.log for ${totalFailed} failed row(s).`);
      process.exitCode = 1;
    } else {
      console.log('\nMigration completed.');
    }
  } finally {
    await extractor.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
