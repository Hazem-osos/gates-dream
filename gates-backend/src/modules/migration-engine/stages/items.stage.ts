import { itemUnitFactor, isLegacyItemGroup, isLegacyStockItem, transformItemCategory, transformLegacyItem, transformLegacyUnit, unitCompanyCode } from '../transforms/item-transform';
import { loadLegacyItems, loadLegacyItemUnits, loadLegacyStores } from '../services/legacy-item-data.service';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { legacyTrim } from '../transforms/legacy-values';
import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';

const STAGE: MigrationStageName = 'ITEMS';
export const ITEMS_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION', 'COA'];

export interface ItemsAnalyzeResult {
  sourceItems: number;
  leafItems: number;
  groupItems: number;
  sourceUnits: number;
  sourceStores: number;
}

export async function analyzeItems(ctx: MigrationContext): Promise<ItemsAnalyzeResult> {
  const [items, units, stores] = await Promise.all([
    loadLegacyItems(ctx.source, ctx.legacyCompanyCode),
    loadLegacyItemUnits(ctx.source, ctx.legacyCompanyCode),
    loadLegacyStores(ctx.source, ctx.legacyCompanyCode),
  ]);
  return {
    sourceItems: items.length,
    leafItems: items.filter((row) => isLegacyStockItem(row)).length,
    groupItems: items.filter((row) => isLegacyItemGroup(row)).length,
    sourceUnits: units.length,
    sourceStores: stores.length,
  };
}

export async function runItemsStage(ctx: MigrationContext): Promise<StageRunReport> {
  const analysis = await analyzeItems(ctx);
  const items = await loadLegacyItems(ctx.source, ctx.legacyCompanyCode);
  const units = await loadLegacyItemUnits(ctx.source, ctx.legacyCompanyCode);
  const stores = await loadLegacyStores(ctx.source, ctx.legacyCompanyCode);

  let written = 0;
  let simulated = 0;
  let errors = 0;
  let warnings = 0;

  const groups = items.filter((row) => isLegacyItemGroup(row));
  const leaves = items.filter((row) => isLegacyStockItem(row));

  for (const row of groups) {
    const result = await upsertCategory(ctx, row, null);
    if (result === 'simulated') simulated += 1;
    else if (result === 'written') written += 1;
  }
  for (const row of groups) {
    const parentCode = legacyTrim(row.ParentItem);
    if (!parentCode) continue;
    const childMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemGroup', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: legacyTrim(row.ItemCode),
    });
    const parentMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemGroup', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: parentCode,
    });
    if (!childMap || !parentMap || ctx.dryRun) continue;
    await ctx.prisma.itemCategory.update({
      where: { id: childMap.targetId },
      data: { parentCategoryId: parentMap.targetId },
    });
  }

  const unitRowsByItem = new Map<string, Record<string, unknown>[]>();
  for (const row of units) {
    const itemCode = legacyTrim(row.ItemCode);
    const list = unitRowsByItem.get(itemCode) ?? [];
    list.push(row);
    unitRowsByItem.set(itemCode, list);
  }

  for (const row of units) {
    const result = await upsertUnit(ctx, row);
    if (result === 'simulated') simulated += 1;
    else if (result === 'written') written += 1;
    else if (result === 'error') errors += 1;
  }

  for (const row of leaves) {
    const parentCode = legacyTrim(row.ParentItem);
    let categoryId: string | null = null;
    if (parentCode) {
      const cat = await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemGroup', {
        companyCode: ctx.legacyCompanyCode,
        itemCode: parentCode,
      });
      categoryId = cat?.targetId ?? null;
    }
    const result = await upsertItem(ctx, row, categoryId);
    if (result === 'simulated') simulated += 1;
    else if (result === 'written') written += 1;
    else errors += 1;

    const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: legacyTrim(row.ItemCode),
    });
    const itemUnits = unitRowsByItem.get(legacyTrim(row.ItemCode)) ?? [];
    if (!itemUnits.length) {
      warnings += 1;
      await ctx.issues.record({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'WARNING',
        category: 'MISSING_UNIT',
        sourceEntity: 'Item',
        sourceKey: legacyTrim(row.ItemCode),
        description: 'Leaf item has no ItemUnit row; PCS default is not assumed as a conversion.',
      });
    }
    if (itemMap && !ctx.dryRun) {
      let baseAssigned = false;
      for (const unitRow of itemUnits) {
        const factor = itemUnitFactor(unitRow);
        if (!factor.ok) {
          errors += 1;
          await ctx.issues.record({
            jobId: ctx.migrationJobId,
            stage: STAGE,
            severity: 'ERROR',
            category: 'QUARANTINE_INVALID_FACTOR',
            sourceEntity: 'ItemUnit',
            sourceKey: `${legacyTrim(row.ItemCode)}|${legacyTrim(unitRow.UnitCode)}`,
            description: 'Conversion factor is missing or <= 0',
          });
          continue;
        }
        const unitMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemUnitDef', {
          companyCode: ctx.legacyCompanyCode,
          unitKey: unitCompanyCode(legacyTrim(unitRow.UnitCode), legacyTrim(unitRow.UnitNameA) || legacyTrim(unitRow.UnitCode)),
        });
        if (!unitMap) continue;
        const isBase = !baseAssigned && factor.factor.eq(1);
        if (isBase) baseAssigned = true;
        await ctx.prisma.itemUnit.upsert({
          where: { itemId_unitId: { itemId: itemMap.targetId, unitId: unitMap.targetId } },
          update: { conversionFactor: factor.factor.toFixed(6), isFactorFixed: factor.isFactorFixed, isBaseUnit: isBase },
          create: {
            itemId: itemMap.targetId,
            unitId: unitMap.targetId,
            conversionFactor: factor.factor.toFixed(6),
            isFactorFixed: factor.isFactorFixed,
            isBaseUnit: isBase,
          },
        });
        await preserveLegacySnapshot(ctx, {
          namespace: IMPORTER_PRESERVE_CONFIG.ItemUnit.preserveNamespace,
          sourceKey: `${legacyTrim(row.ItemCode)}|${legacyTrim(unitRow.UnitCode)}`,
          raw: unitRow as Record<string, unknown>,
          mappedColumns: IMPORTER_PRESERVE_CONFIG.ItemUnit.mappedColumns,
        });
      }
    }
  }

  for (const row of stores) {
    await attachWarehouseAccounts(ctx, row);
  }

  if (!ctx.dryRun) {
    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity: 'Item',
      cursorKey: '__DONE__',
      processedCount: BigInt(items.length),
      successCount: BigInt(written),
      warningCount: BigInt(warnings),
      errorCount: BigInt(errors),
    });
  }

  return {
    stage: STAGE,
    sourceCounts: { ...analysis },
    transformed: items.length + units.length,
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings,
    errors,
    blockers: 0,
  };
}

async function upsertCategory(ctx: MigrationContext, row: Record<string, unknown>, parentId: string | null) {
  const itemCode = legacyTrim(row.ItemCode);
  const key = { companyCode: ctx.legacyCompanyCode, itemCode };
  if (await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemGroup', key)) return 'mapped';
  if (ctx.dryRun) {
    ctx.idMap.planMapping(ctx.migrationJobId, 'ItemGroup', key);
    return 'simulated';
  }
  const data = transformItemCategory(row, ctx.targetCompanyId);
  const existing = await ctx.prisma.itemCategory.findFirst({
    where: { companyId: ctx.targetCompanyId, code: data.code },
  });
  const created = existing
    ? await ctx.prisma.itemCategory.update({ where: { id: existing.id }, data: { ...data, parentCategoryId: parentId } })
    : await ctx.prisma.itemCategory.create({ data: { ...data, parentCategoryId: parentId } });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'ItemGroup',
    sourceKeyParts: key,
    targetModel: 'ItemCategory',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  return 'written';
}

async function upsertUnit(ctx: MigrationContext, row: Record<string, unknown>) {
  const factor = itemUnitFactor(row);
  if (!factor.ok) return 'error';
  const data = transformLegacyUnit(row, ctx.targetCompanyId);
  const key = { companyCode: ctx.legacyCompanyCode, unitKey: data.code };
  if (await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemUnitDef', key)) return 'mapped';
  if (ctx.dryRun) {
    ctx.idMap.planMapping(ctx.migrationJobId, 'ItemUnitDef', key);
    return 'simulated';
  }
  const created = await ctx.prisma.unit.upsert({
    where: { companyId_code: { companyId: ctx.targetCompanyId, code: data.code } },
    update: { arabicName: data.arabicName, englishName: data.englishName },
    create: data,
  });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'ItemUnitDef',
    sourceKeyParts: key,
    targetModel: 'Unit',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  await preserveLegacySnapshot(ctx, {
    namespace: IMPORTER_PRESERVE_CONFIG.ItemUnit.preserveNamespace,
    sourceKey: data.code,
    raw: row,
    mappedColumns: IMPORTER_PRESERVE_CONFIG.ItemUnit.mappedColumns,
  });
  return 'written';
}

async function upsertItem(ctx: MigrationContext, row: Record<string, unknown>, categoryId: string | null) {
  const itemCode = legacyTrim(row.ItemCode);
  const key = { companyCode: ctx.legacyCompanyCode, itemCode };
  if (await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', key)) return 'mapped';
  if (ctx.dryRun) {
    ctx.idMap.planMapping(ctx.migrationJobId, 'Item', key);
    return 'simulated';
  }
  const data = transformLegacyItem(row, ctx.targetCompanyId, categoryId);
  const existing = await ctx.prisma.item.findFirst({
    where: { companyId: ctx.targetCompanyId, serial: itemCode },
  });
  const created = existing
    ? await ctx.prisma.item.update({ where: { id: existing.id }, data })
    : await ctx.prisma.item.create({ data });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'Item',
    sourceKeyParts: key,
    targetModel: 'Item',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  await preserveLegacySnapshot(ctx, {
    namespace: IMPORTER_PRESERVE_CONFIG.Item.preserveNamespace,
    sourceKey: itemCode,
    raw: row,
    mappedColumns: IMPORTER_PRESERVE_CONFIG.Item.mappedColumns,
  });
  return 'written';
}

async function attachWarehouseAccounts(ctx: MigrationContext, row: Record<string, unknown>) {
  const storeCode = legacyTrim(row.StoreCode);
  const whMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
    companyCode: ctx.legacyCompanyCode,
    storeCode,
  });
  if (!whMap || ctx.dryRun) return;
  const invCode = normalizeLegacyAccountCode(legacyTrim(row.StoreAccountCode));
  const costCode = normalizeLegacyAccountCode(legacyTrim(row.CostAccountCode));
  const giftCode = normalizeLegacyAccountCode(legacyTrim(row.OfferAccountCode));
  const resolve = async (code: string) => {
    if (!code) return null;
    const mapped = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode: code,
    });
    if (mapped) return mapped.targetId;
    const acc = await ctx.prisma.account.findFirst({
      where: { companyId: ctx.targetCompanyId, code, deletedAt: null },
      select: { id: true },
    });
    return acc?.id ?? null;
  };
  await ctx.prisma.warehouse.update({
    where: { id: whMap.targetId },
    data: {
      inventoryAccountId: await resolve(invCode),
      costAccountId: await resolve(costCode),
      giftAccountId: await resolve(giftCode),
      warehouseKind: legacyTrim(row.HasChild).toUpperCase() === 'T' ? 'HEADER' : 'POSTING',
    },
  });
}
