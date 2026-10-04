import {
  transformBranch,
  transformCostCenter,
  transformFiscalYear,
  transformWarehouse,
} from '../transforms/foundation-transform';
import { legacyTrim } from '../transforms/legacy-values';
import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';

const STAGE: MigrationStageName = 'FOUNDATION';

const ENTITIES = ['Branch', 'Year', 'Currency', 'CostCenter', 'Store'] as const;

export const FOUNDATION_STAGE_DEPS: MigrationStageName[] = [];

function trimRow(row: Record<string, unknown>) {
  return row;
}

export async function analyzeFoundation(ctx: MigrationContext): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ENTITIES) {
    counts[table] = await ctx.source.count(table, ctx.legacyCompanyCode);
  }
  counts.Unit = 1;
  return counts;
}

export async function runFoundationStage(ctx: MigrationContext): Promise<StageRunReport> {
  const sourceCounts = await analyzeFoundation(ctx);
  let transformed = 0;
  let written = 0;
  let simulated = 0;

  const company = await ctx.prisma.company.findUnique({ where: { id: ctx.targetCompanyId } });
  if (!company) {
    throw new Error(`Target company not found: ${ctx.targetCompanyId}`);
  }
  if (!company.legacyCompanyCode) {
    const legacyTaken = await ctx.prisma.company.findFirst({
      where: { legacyCompanyCode: ctx.legacyCompanyCode, NOT: { id: ctx.targetCompanyId } },
      select: { id: true },
    });
    if (!legacyTaken) {
      if (!ctx.dryRun) {
        await ctx.prisma.company.update({
          where: { id: ctx.targetCompanyId },
          data: { legacyCompanyCode: ctx.legacyCompanyCode },
        });
      } else {
        simulated += 1;
      }
    }
  }

  await streamEntity(ctx, 'Branch', async (row) => {
    const branchCode = legacyTrim(row.BranchCode);
    const data = transformBranch(row, ctx.targetCompanyId);
    const key = { companyCode: ctx.legacyCompanyCode, branchCode };
    const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', key);
    if (existingMap) return;
    if (ctx.dryRun) {
      simulated += 1;
      return;
    }
    const existing = await ctx.prisma.branch.findFirst({
      where: { companyId: ctx.targetCompanyId, legacyBranchCode: branchCode },
    });
    if (existing && existing.companyId !== ctx.targetCompanyId) {
      throw new Error('NATIVE_TARGET_CONFLICT: branch belongs to another company');
    }
    const created = !existing;
    const branch = existing
      ? await ctx.prisma.branch.update({ where: { id: existing.id }, data })
      : await ctx.prisma.branch.create({ data });
    if (created) written += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Branch',
      sourceKeyParts: key,
      targetModel: 'Branch',
      targetId: branch.id,
      outcome: created ? 'CREATED_BY_MIGRATION' : 'ALREADY_MAPPED',
    });
  });

  // Fiscal years
  await streamEntity(ctx, 'Year', async (row) => {
    const yearCode = legacyTrim(row.YearCode ?? row.YearID);
    const data = transformFiscalYear(row, ctx.targetCompanyId);
    const key = { companyCode: ctx.legacyCompanyCode, yearCode };
    const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', key);
    if (existingMap) return;
    if (ctx.dryRun) {
      simulated += 1;
      return;
    }
    const year = await ctx.prisma.fiscalYear.upsert({
      where: { companyId_legacyYearId: { companyId: ctx.targetCompanyId, legacyYearId: yearCode } },
      update: {
        arabicName: data.arabicName,
        englishName: data.englishName,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
      },
      create: data,
    });
    written += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Year',
      sourceKeyParts: key,
      targetModel: 'FiscalYear',
      targetId: year.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  });

  await streamEntity(ctx, 'Currency', async (row) => {
    const code = legacyTrim(row.CurrencyCode ?? row.Code);
    const key = { companyCode: ctx.legacyCompanyCode, code };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'Currency', key)) return;
    if (ctx.dryRun) {
      simulated += 1;
      return;
    }
    const cur = await ctx.prisma.currency.upsert({
      where: { companyId_code: { companyId: ctx.targetCompanyId, code } },
      update: {},
      create: {
        companyId: ctx.targetCompanyId,
        code,
        arabicName: legacyTrim(row.CurrencyNameA ?? row.NameA) || code,
        englishName: legacyTrim(row.CurrencyNameE ?? row.NameE) || null,
        exchangeRate: 1,
      },
    });
    written += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Currency',
      sourceKeyParts: key,
      targetModel: 'Currency',
      targetId: cur.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  });

  await streamEntity(ctx, 'CostCenter', async (row) => {
    const code = legacyTrim(row.CCenterCode ?? row.CostCenterCode);
    const data = transformCostCenter(row, ctx.targetCompanyId);
    const key = { companyCode: ctx.legacyCompanyCode, code };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', key)) return;
    if (ctx.dryRun) {
      simulated += 1;
      return;
    }
    const cc = await ctx.prisma.costCenter.upsert({
      where: { companyId_code: { companyId: ctx.targetCompanyId, code } },
      update: { arabicName: data.arabicName, englishName: data.englishName },
      create: data,
    });
    written += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'CostCenter',
      sourceKeyParts: key,
      targetModel: 'CostCenter',
      targetId: cc.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  });

  await streamEntity(ctx, 'Store', async (row) => {
    const storeCode = legacyTrim(row.StoreCode ?? row.Code);
    const branchCode = legacyTrim(row.BranchCode);
    let branchId: string | undefined;
    if (branchCode) {
      const bMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
        companyCode: ctx.legacyCompanyCode,
        branchCode,
      });
      branchId = bMap?.targetId;
    }
    const data = transformWarehouse(row, ctx.targetCompanyId, branchId);
    const key = { companyCode: ctx.legacyCompanyCode, storeCode };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', key)) return;
    if (ctx.dryRun) {
      simulated += 1;
      return;
    }
    const existing = await ctx.prisma.warehouse.findFirst({
      where: { companyId: ctx.targetCompanyId, legacyStoreCode: storeCode },
    });
    const wh = existing
      ? await ctx.prisma.warehouse.update({ where: { id: existing.id }, data })
      : await ctx.prisma.warehouse.create({ data });
    written += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Store',
      sourceKeyParts: key,
      targetModel: 'Warehouse',
      targetId: wh.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  });

  // Default unit PCS
  if (!ctx.dryRun) {
    await ctx.prisma.unit.upsert({
      where: { companyId_code: { companyId: ctx.targetCompanyId, code: 'PCS' } },
      update: {},
      create: { companyId: ctx.targetCompanyId, code: 'PCS', arabicName: 'Piece', englishName: 'Piece' },
    });
    written += 1;
  } else {
    simulated += 1;
  }

  transformed = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);

  return {
    stage: STAGE,
    sourceCounts,
    transformed,
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings: 0,
    errors: 0,
    blockers: openBlockers,
  };
}

async function streamEntity(
  ctx: MigrationContext,
  entity: string,
  handler: (row: Record<string, unknown>) => Promise<void>
) {
  const batchSize = ctx.options.batchSize ?? 200;
  let cursor: string | null = null;
  let processed = 0n;
  const cp = await ctx.checkpoints.load(ctx.migrationJobId, STAGE, entity);
  if (cp?.cursorKey === '__DONE__') return;
  if (cp?.cursorKey) cursor = cp.cursorKey;

  for (;;) {
    const batch = await ctx.source.queryBatch(entity, ctx.legacyCompanyCode, cursor, batchSize);
    for (const row of batch.rows) {
      await handler(trimRow(row));
      processed += 1n;
    }
    cursor = batch.nextCursor;
    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity,
      cursorKey: cursor,
      processedCount: processed,
      successCount: processed,
      warningCount: 0n,
      errorCount: 0n,
    });
    if (process.env.MIGRATION_TEST_FAIL_ENTITY === entity) {
      throw new Error(`MIGRATION_TEST_SIMULATED_FAILURE:${entity}`);
    }
    if (!batch.nextCursor) {
      if (!ctx.dryRun) {
        await ctx.checkpoints.save({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          entity,
          cursorKey: '__DONE__',
          processedCount: processed,
          successCount: processed,
          warningCount: 0n,
          errorCount: 0n,
        });
      }
      break;
    }
  }
}
