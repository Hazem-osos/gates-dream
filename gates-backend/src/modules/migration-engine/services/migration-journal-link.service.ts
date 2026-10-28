import type { MigrationContext } from '../migration-context';
import { journalSourceKey } from '../transforms/journal-transform';
import { legacyTrim, padGlNum } from '../transforms/legacy-values';

/** Resolve imported historical journal — never creates journals (GLTrx stage owns that). */
export async function resolveHistoricalJournalEntryId(
  ctx: MigrationContext,
  branchCode: string,
  yearId: string,
  glNumRaw: unknown
): Promise<string | null> {
  const glNum = padGlNum(glNumRaw);
  if (!glNum || glNum === '00000000') return null;

  const key = journalSourceKey({
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(branchCode),
    yearId: legacyTrim(yearId),
    glNum,
  });
  const mapped = await ctx.idMap.findMapping(ctx.migrationJobId, 'GLTrxHeader', key);
  if (mapped?.targetId) return mapped.targetId;

  const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(branchCode),
  });
  const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
    companyCode: ctx.legacyCompanyCode,
    yearCode: legacyTrim(yearId),
  });

  const found = await ctx.prisma.journalEntry.findFirst({
    where: {
      companyId: ctx.targetCompanyId,
      legacyGlNum: glNum,
      branchId: branchMap?.targetId ?? null,
      fiscalYearId: yearMap?.targetId ?? null,
    },
    select: { id: true },
  });
  return found?.id ?? null;
}
