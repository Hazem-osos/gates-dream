import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';
import { legacyTableExists } from '../accounting-source-profile';
import {
  ckSubCursor,
  ckTrxDetailCursor,
  loadCkTrxDetailBatch,
  loadCkTrxDetailSubBatch,
  loadPkTrxDetailBatch,
  loadPkTrxDetailSubBatch,
  pkSubCursor,
  pkTrxDetailCursor,
  type LegacyChequeLineRow,
  type LegacyCkTrxDetailSubRow,
  type LegacyPkTrxDetailSubRow,
} from '../services/legacy-cheque-data.service';
import { resolveHistoricalJournalEntryId } from '../services/migration-journal-link.service';
import {
  ckTrxSourceKeyParts,
  pkTrxSourceKeyParts,
  transformHistoricalCheque,
} from '../transforms/cheque-historical-transform';
import { decideHistoricalChequeImport } from '../treasury/settlement-cheque-decision';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { legacyTrim } from '../transforms/legacy-values';

import { loadChequeNumberPlan, type ChequeNumberPlan } from '../treasury/cheque-number-plan';
import { buildPartyRefResolver, type PartyRefResolver } from '../services/migration-party-ref.service';
import { mapLegacyChequeDirection } from '../treasury/settlement-cheque-decision';

const STAGE: MigrationStageName = 'CHEQUE_HISTORICAL';

export const CHEQUE_HISTORICAL_STAGE_DEPS: MigrationStageName[] = ['ACCOUNTING', 'PARTIES'];

export async function analyzeChequeHistorical(ctx: MigrationContext) {
  const hasCk = await legacyTableExists(ctx.source, 'CKTrxDetail');
  const hasPk = await legacyTableExists(ctx.source, 'PKTrxDetail');
  const hasSub = await legacyTableExists(ctx.source, 'CKTrxDetailSub');
  return {
    hasCkTrxDetail: hasCk,
    hasPkTrxDetail: hasPk,
    hasCkTrxDetailSub: hasSub,
    policy: 'Historical cheques (CK01/PK01) — journal links only, no posting service',
  };
}

async function importChequeLineBatch(
  ctx: MigrationContext,
  params: {
    sourceEntity: 'CKTrxDetail' | 'PKTrxDetail';
    row: LegacyChequeLineRow;
    sourceKeyParts: Record<string, string>;
    cursorKey: string;
    chequeNumberOf?: ChequeNumberPlan;
    parties?: PartyRefResolver;
  }
): Promise<'written' | 'skipped' | 'blocked' | 'error'> {
  const { sourceEntity, row, sourceKeyParts, cursorKey } = params;
  const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, sourceEntity, sourceKeyParts);
  const decision = decideHistoricalChequeImport({
    row,
    sourceEntity,
    alreadyMapped: Boolean(existingMap),
  });

  if (decision.action === 'SKIP_ALREADY_MAPPED' || decision.action === 'SKIP_INACTIVE') return 'skipped';
  if (decision.action === 'BLOCK') {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'WARNING',
      category: decision.category,
      sourceEntity,
      sourceKey: cursorKey,
      description: decision.reason,
    });
    return 'blocked';
  }

  const branchCode = legacyTrim(row.BranchCode);
  const yearId = legacyTrim(row.YearID);

  const portfolioJournalEntryId = await resolveHistoricalJournalEntryId(ctx, branchCode, yearId, row.EditGLNum);
  const clearJournalEntryId = await resolveHistoricalJournalEntryId(
    ctx,
    branchCode,
    legacyTrim(row.TakeYearID) || yearId,
    row.TakeGLNum
  );
  const endorseJournalEntryId = await resolveHistoricalJournalEntryId(
    ctx,
    branchCode,
    legacyTrim(row.TazherYearID) || yearId,
    row.TazherGLNum
  );
  const depositJournalEntryId = await resolveHistoricalJournalEntryId(
    ctx,
    branchCode,
    legacyTrim(row.BankYearID) || yearId,
    row.BankGLNum
  );
  const cancelJournalEntryId = await resolveHistoricalJournalEntryId(
    ctx,
    branchCode,
    legacyTrim(row.ReturnYearID) || yearId,
    row.ReturnGLNum
  );

  if (ctx.dryRun) {
    ctx.idMap.planMapping(ctx.migrationJobId, sourceEntity, sourceKeyParts);
    return 'written';
  }

  const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
    companyCode: ctx.legacyCompanyCode,
    branchCode,
  });
  const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
    companyCode: ctx.legacyCompanyCode,
    yearCode: yearId,
  });

  // Inward cheques come from customers, outward cheques go to suppliers. GehaCode holds the
  // party code (or its account); the counter account is the fallback.
  const geha = legacyTrim(row.GehaCode);
  const inward = mapLegacyChequeDirection(String(row.Type ?? ''), sourceEntity) === 'INWARD';
  const parties = params.parties ?? (await buildPartyRefResolver(ctx));
  let customerId: string | null = null;
  let supplierId: string | null = null;
  if (inward) {
    customerId = (await parties.customerId(geha)) ?? (await parties.customerId(row.FromAccountNo));
  } else {
    supplierId = (await parties.supplierId(geha)) ?? (await parties.supplierId(row.FromAccountNo));
  }

  const data = transformHistoricalCheque(row, sourceEntity, {
    companyId: ctx.targetCompanyId,
    branchId: branchMap?.targetId ?? null,
    fiscalYearId: yearMap?.targetId ?? null,
    customerId,
    supplierId,
    portfolioJournalEntryId,
    depositJournalEntryId,
    clearJournalEntryId,
    endorseJournalEntryId,
    cancelJournalEntryId,
  });
  if (params.chequeNumberOf) data.chequeNumber = params.chequeNumberOf(row, data.direction);

  const existing = await ctx.prisma.cheque.findFirst({
    where: {
      companyId: ctx.targetCompanyId,
      chequeNumber: data.chequeNumber,
      direction: data.direction,
    },
  });

  const cheque = existing
    ? await ctx.prisma.cheque.update({ where: { id: existing.id }, data })
    : await ctx.prisma.cheque.create({ data });

  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity,
    sourceKeyParts,
    targetModel: 'Cheque',
    targetId: cheque.id,
    outcome: existing ? 'ALREADY_MAPPED' : 'CREATED_BY_MIGRATION',
    readOnly: true,
  });
  const cfg =
    sourceEntity === 'CKTrxDetail'
      ? IMPORTER_PRESERVE_CONFIG.CKTrxDetail
      : IMPORTER_PRESERVE_CONFIG.PKTrxDetail;
  await preserveLegacySnapshot(ctx, {
    namespace: cfg.preserveNamespace,
    sourceKey: cursorKey,
    raw: row as Record<string, unknown>,
    mappedColumns: cfg.mappedColumns,
  });
  return 'written';
}

async function importCkSubLine(ctx: MigrationContext, row: LegacyCkTrxDetailSubRow): Promise<'linked' | 'skipped' | 'issue'> {
  const sourceKey = {
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    ckNum: legacyTrim(row.CKNum),
    takeGlNum: legacyTrim(row.TakeGLNum),
    takeAmountDate: legacyTrim(row.TakeAmountDate),
  };
  const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CKTrxDetailSub', sourceKey);
  if (existingMap) return 'skipped';

  const parentKey = {
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    ckNum: legacyTrim(row.CKNum),
  };
  const parentMaps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'CKTrxDetail' },
    take: 5000,
  });
  const parent = parentMaps.find(
    (m) =>
      m.sourceKey.includes(`branchCode=${parentKey.branchCode}`) &&
      m.sourceKey.includes(`yearId=${parentKey.yearId}`) &&
      m.sourceKey.includes(`type=${parentKey.type}`) &&
      m.sourceKey.includes(`ckNum=${parentKey.ckNum}`)
  );
  if (!parent) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'WARNING',
      category: 'CKTRX_SUB_PARENT_MISSING',
      sourceEntity: 'CKTrxDetailSub',
      sourceKey: ckSubCursor(row),
      description: 'CKTrxDetailSub row has no matching CKTrxDetail parent in this job',
    });
    return 'issue';
  }

  const takeJeId = await resolveHistoricalJournalEntryId(
    ctx,
    legacyTrim(row.BranchCode),
    legacyTrim(row.TakeYearID) || legacyTrim(row.YearID),
    row.TakeGLNum
  );

  if (!ctx.dryRun && takeJeId) {
    const cheque = await ctx.prisma.cheque.findUnique({ where: { id: parent.targetId } });
    if (cheque && !cheque.clearJournalEntryId) {
      await ctx.prisma.cheque.update({
        where: { id: cheque.id },
        data: { clearJournalEntryId: takeJeId, status: cheque.status === 'UNDER_HAND' ? 'COLLECTED' : cheque.status },
      });
    } else if (cheque?.clearJournalEntryId && cheque.clearJournalEntryId !== takeJeId) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'INFO',
        category: 'CKTRX_SUB_EXTRA_COLLECTION',
        sourceEntity: 'CKTrxDetailSub',
        sourceKey: ckSubCursor(row),
        description: `Additional collection GL ${legacyTrim(row.TakeGLNum)} — only first clearJournalEntryId stored on Cheque`,
      });
    }
  }

  if (!ctx.dryRun) {
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'CKTrxDetailSub',
      sourceKeyParts: sourceKey,
      targetModel: 'Cheque',
      targetId: parent.targetId,
      outcome: 'CREATED_BY_MIGRATION',
      readOnly: true,
    });
  }
  return 'linked';
}

async function importPkSubLine(ctx: MigrationContext, row: LegacyPkTrxDetailSubRow): Promise<'linked' | 'skipped' | 'issue'> {
  const sourceKey = {
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    pkNum: legacyTrim(row.PKNum),
    takeGlNum: legacyTrim(row.TakeGLNum),
    takeAmountDate: legacyTrim(row.TakeAmountDate),
  };
  const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'PKTrxDetailSub', sourceKey);
  if (existingMap) return 'skipped';

  const parentKey = {
    companyCode: ctx.legacyCompanyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    pkNum: legacyTrim(row.PKNum),
  };
  const parentMaps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'PKTrxDetail' },
    take: 5000,
  });
  const parent = parentMaps.find(
    (m) =>
      m.sourceKey.includes(`branchCode=${parentKey.branchCode}`) &&
      m.sourceKey.includes(`yearId=${parentKey.yearId}`) &&
      m.sourceKey.includes(`type=${parentKey.type}`) &&
      m.sourceKey.includes(`pkNum=${parentKey.pkNum}`)
  );
  if (!parent) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'WARNING',
      category: 'PKTRX_SUB_PARENT_MISSING',
      sourceEntity: 'PKTrxDetailSub',
      sourceKey: pkSubCursor(row),
      description: 'PKTrxDetailSub row has no matching PKTrxDetail parent in this job',
    });
    return 'issue';
  }

  const takeJeId = await resolveHistoricalJournalEntryId(
    ctx,
    legacyTrim(row.BranchCode),
    legacyTrim(row.TakeYearID) || legacyTrim(row.YearID),
    row.TakeGLNum
  );

  if (!ctx.dryRun && takeJeId) {
    const cheque = await ctx.prisma.cheque.findUnique({ where: { id: parent.targetId } });
    if (cheque && !cheque.clearJournalEntryId) {
      await ctx.prisma.cheque.update({
        where: { id: cheque.id },
        data: { clearJournalEntryId: takeJeId, status: cheque.status === 'UNDER_HAND' ? 'COLLECTED' : cheque.status },
      });
    } else if (cheque?.clearJournalEntryId && cheque.clearJournalEntryId !== takeJeId) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'INFO',
        category: 'PKTRX_SUB_EXTRA_COLLECTION',
        sourceEntity: 'PKTrxDetailSub',
        sourceKey: pkSubCursor(row),
        description: `Additional outward collection GL ${legacyTrim(row.TakeGLNum)} — only first clearJournalEntryId stored on Cheque`,
      });
    }
  }

  if (!ctx.dryRun) {
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'PKTrxDetailSub',
      sourceKeyParts: sourceKey,
      targetModel: 'Cheque',
      targetId: parent.targetId,
      outcome: 'CREATED_BY_MIGRATION',
      readOnly: true,
    });
  }
  return 'linked';
}

export async function runChequeHistoricalStage(ctx: MigrationContext): Promise<StageRunReport> {
  const batchSize = ctx.options.batchSize ?? 100;
  let processed = 0;
  let written = 0;
  let skipped = 0;
  let blockers = 0;
  let subLinked = 0;

  const chequeNumberOf = await loadChequeNumberPlan(ctx.source, ctx.legacyCompanyCode);
  const parties = ctx.dryRun ? undefined : await buildPartyRefResolver(ctx);
  type ChequeLoader = typeof loadCkTrxDetailBatch;
  for (const loader of [
    { entity: 'CKTrxDetail' as const, load: loadCkTrxDetailBatch as ChequeLoader },
    { entity: 'PKTrxDetail' as const, load: loadPkTrxDetailBatch as ChequeLoader },
  ]) {
    let cursor: string | null = null;
    for (;;) {
      await ctx.throwIfPaused({ stage: STAGE, entity: loader.entity });
      const batch: Awaited<ReturnType<ChequeLoader>> = await loader.load(
        ctx.source,
        ctx.legacyCompanyCode,
        cursor,
        batchSize
      );
      if (!batch.rows.length) break;
      cursor = batch.nextCursor;

      for (const row of batch.rows) {
        processed += 1;
        try {
          const sourceKeyParts =
            loader.entity === 'CKTrxDetail'
              ? ckTrxSourceKeyParts(row, ctx.legacyCompanyCode)
              : pkTrxSourceKeyParts(row, ctx.legacyCompanyCode);
          const cursorKey =
            loader.entity === 'CKTrxDetail' ? ckTrxDetailCursor(row) : pkTrxDetailCursor(row);
          const outcome = await importChequeLineBatch(ctx, {
            sourceEntity: loader.entity,
            row,
            sourceKeyParts,
            cursorKey,
            chequeNumberOf,
            parties,
          });
          if (outcome === 'written') written += 1;
          else if (outcome === 'skipped') skipped += 1;
          else if (outcome === 'blocked') blockers += 1;
        } catch (err) {
          blockers += 1;
          await ctx.issues.record({
            jobId: ctx.migrationJobId,
            stage: STAGE,
            severity: 'ERROR',
            category: 'CHEQUE_IMPORT_ERROR',
            sourceEntity: loader.entity,
            sourceKey: loader.entity === 'CKTrxDetail' ? ckTrxDetailCursor(row) : pkTrxDetailCursor(row),
            description: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await ctx.checkpoints.save({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        entity: loader.entity,
        cursorKey: cursor,
        processedCount: BigInt(processed),
        successCount: BigInt(written),
        warningCount: BigInt(skipped),
        errorCount: BigInt(blockers),
      });

      if (!batch.nextCursor) break;
    }
  }

  for (const subLoader of [
    { entity: 'CKTrxDetailSub' as const, load: loadCkTrxDetailSubBatch, importFn: importCkSubLine },
    { entity: 'PKTrxDetailSub' as const, load: loadPkTrxDetailSubBatch, importFn: importPkSubLine },
  ]) {
    let subCursor: string | null = null;
    for (;;) {
      await ctx.throwIfPaused({ stage: STAGE, entity: subLoader.entity });
      const subBatch: { rows: (LegacyCkTrxDetailSubRow & LegacyPkTrxDetailSubRow)[]; nextCursor: string | null } =
        await subLoader.load(ctx.source, ctx.legacyCompanyCode, subCursor, batchSize);
      if (!subBatch.rows.length) break;
      subCursor = subBatch.nextCursor;
      for (const sub of subBatch.rows) {
        processed += 1;
        const r = await subLoader.importFn(ctx, sub as LegacyCkTrxDetailSubRow & LegacyPkTrxDetailSubRow);
        if (r === 'linked') subLinked += 1;
        else if (r === 'issue') blockers += 1;
        else skipped += 1;
      }
      if (!subBatch.nextCursor) break;
    }
  }

  const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);
  return {
    stage: STAGE,
    sourceCounts: { processed, skipped, blockers, subLinked },
    transformed: processed,
    written,
    simulated: ctx.dryRun ? written : 0,
    warnings: skipped,
    errors: blockers,
    blockers: openBlockers,
  };
}
