/**
 * Phase D — optional M3 persons + M2 cheques when present in the legacy extract.
 * Skips tables that are absent from the dump (typical for the sample fixtures).
 */
import type { MigrationContext } from '../types';
import { legacyTrim, legacyBool } from '../utils/legacy-values';

function track(ctx: MigrationContext, table: string) {
  let stat = ctx.stats.find((s) => s.table === table);
  if (!stat) {
    stat = { table, read: 0, upserted: 0, skipped: 0, failed: 0 };
    ctx.stats.push(stat);
  }
  return stat;
}

export async function runPhaseD(ctx: MigrationContext) {
  const { extractor, options, prisma } = ctx;
  const extractOptions = { batchSize: options.batchSize, companyCode: options.companyCode };

  let personRows: Record<string, unknown>[] = [];
  try {
    personRows = await extractor.loadTable('Person', extractOptions);
  } catch {
    console.log('Phase D: Person table not in extract — skipped');
    return;
  }

  if (personRows.length === 0) {
    console.log('Phase D: Person — 0 rows');
    return;
  }

  const stat = track(ctx, 'Person');
  console.log('\n=== Phase D: Persons (and cheque headers if present) ===');

  for (const row of personRows) {
    stat.read += 1;
    const legacyCode = legacyTrim(row.PersonCode ?? row.Code);
    if (!legacyCode) {
      stat.skipped += 1;
      continue;
    }
    const companyCode = legacyTrim(row.CompanyCode) || options.companyCode;
    if (!companyCode) {
      stat.skipped += 1;
      continue;
    }
    const companyId = ctx.cache.get(ctx.cache.keyCompany(companyCode));
    if (!companyId || ctx.options.dryRun) {
      if (ctx.options.dryRun) stat.upserted += 1;
      else {
        stat.skipped += 1;
      }
      continue;
    }

    const name = legacyTrim(row.PersonNameA ?? row.PersonName) || legacyCode;
    try {
      const existing = await prisma.person.findFirst({
        where: { companyId, legacyCode },
      });
      if (existing) {
        await prisma.person.update({
          where: { id: existing.id },
          data: {
            arabicName: name,
            englishName: legacyTrim(row.PersonNameE) || null,
            isActive: !legacyBool(row.Deleted, false),
          },
        });
      } else {
        await prisma.person.create({
          data: {
            companyId,
            legacyCode,
            arabicName: name,
            englishName: legacyTrim(row.PersonNameE) || null,
            isActive: !legacyBool(row.Deleted, false),
          },
        });
      }
      stat.upserted += 1;
    } catch (e) {
      stat.failed += 1;
      ctx.logError('D', 'Person', row, e);
    }
  }

  let chequeHeaders: Record<string, unknown>[] = [];
  try {
    chequeHeaders = await extractor.loadTable('CKTrxHeader', extractOptions);
  } catch {
    console.log('Phase D: CKTrxHeader not in extract — cheques skipped');
    return;
  }

  const ckStat = track(ctx, 'CKTrxHeader');
  ckStat.read = chequeHeaders.length;
  if (chequeHeaders.length === 0) {
    console.log('Phase D: CKTrxHeader — 0 rows');
    return;
  }

  console.log(
    `Phase D: CKTrxHeader — ${chequeHeaders.length} row(s) detected (import not yet implemented; logged only)`
  );
}
