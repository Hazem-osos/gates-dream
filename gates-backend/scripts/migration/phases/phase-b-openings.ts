import type { MigrationContext } from '../types';
import { legacyDecimal, legacyDate, legacyTrim } from '../utils/legacy-values';
import { logBatchProgress } from '../utils/migration-logger';

function track(ctx: MigrationContext, table: string) {
  let stat = ctx.stats.find((s) => s.table === table);
  if (!stat) {
    stat = { table, read: 0, upserted: 0, skipped: 0, failed: 0 };
    ctx.stats.push(stat);
  }
  return stat;
}

export async function runPhaseB(ctx: MigrationContext) {
  console.log('\n=== Phase B: Opening balances ===');

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'ItemStore',
    ctx.options
  )) {
    const stat = track(ctx, 'ItemStore');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const itemCode = legacyTrim(row.ItemCode);
        const storeCode = legacyTrim(row.StoreCode);
        const itemId = ctx.cache.require(ctx.cache.keyItem(companyCode, itemCode), 'item');
        const warehouseId = ctx.cache.require(
          ctx.cache.keyWarehouse(companyCode, storeCode),
          'warehouse'
        );
        const qty = legacyDecimal(row.Quantity ?? row.Qty, 3);
        if (ctx.options.dryRun) {
          stat.upserted += 1;
          continue;
        }
        const existingQty = await ctx.prisma.itemQuantity.findFirst({
          where: { itemId, warehouseId, locationId: null },
        });
        if (existingQty) {
          await ctx.prisma.itemQuantity.update({
            where: { id: existingQty.id },
            data: { quantity: qty },
          });
        } else {
          await ctx.prisma.itemQuantity.create({
            data: { itemId, warehouseId, quantity: qty },
          });
        }
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('B', 'ItemStore', row, e);
      }
    }
    logBatchProgress('B', 'ItemStore', batchIndex, batchTotal, stat.upserted);
  }

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'ItemCost',
    ctx.options
  )) {
    const stat = track(ctx, 'ItemCost');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchCode = legacyTrim(row.BranchCode);
        const branchId = ctx.cache.require(ctx.cache.keyBranch(companyCode, branchCode), 'branch');
        const itemCode = legacyTrim(row.ItemCode);
        const itemId = ctx.cache.require(ctx.cache.keyItem(companyCode, itemCode), 'item');
        const serial = parseInt(String(row.Serial ?? row.IdNum ?? '1'), 10) || 1;
        const sourceType = legacyTrim(row.SourceType ?? 'OPENING') || 'OPENING';
        const sourceNumber = legacyTrim(row.SourceNum ?? row.TrxNum ?? '0') || '0';
        const sourceYearId = legacyTrim(row.YearID ?? row.YearCode) || '00000000';
        if (ctx.options.dryRun) {
          stat.upserted += 1;
          continue;
        }
        await ctx.prisma.itemCostHistory.upsert({
          where: {
            companyId_itemId_sourceType_sourceNumber_sourceYearId: {
              companyId,
              itemId,
              sourceType,
              sourceNumber,
              sourceYearId,
            },
          },
          update: {
            cost: legacyDecimal(row.Cost ?? row.AverageCost, 4),
            effectiveAt: legacyDate(row.Date) ?? new Date(),
            documentDate: legacyDate(row.Date) ?? new Date(),
          },
          create: {
            companyId,
            branchId,
            itemId,
            serial,
            cost: legacyDecimal(row.Cost ?? row.AverageCost, 4),
            effectiveAt: legacyDate(row.Date) ?? new Date(),
            documentDate: legacyDate(row.Date) ?? new Date(),
            sourceType,
            sourceNumber,
            sourceYearId,
          },
        });
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('B', 'ItemCost', row, e);
      }
    }
    logBatchProgress('B', 'ItemCost', batchIndex, batchTotal, stat.upserted);
  }
}
