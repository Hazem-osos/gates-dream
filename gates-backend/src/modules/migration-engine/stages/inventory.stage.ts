import { createHash } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { money, money2 } from '../accounting/journal-money';
import {
  baseQuantity,
  conversionFactor,
  decidePostedStockDocument,
  invoiceStockSign,
  isDefensiblePurchaseCost,
  transferQuantity,
} from '../inventory/inventory-decision';
import type { MigrationContext } from '../migration-context';
import {
  countPostedStocktake,
  loadLegacyItemCosts,
  loadPostedInvoiceStockLines,
  loadPostedPurchaseLineCosts,
  loadPostedStoreAdjustDetailLines,
  loadPostedStoreCheckDetailLines,
  loadPostedStoreCollLines,
  loadPostedStoreTransLines,
  type LegacyStockMovementRow,
} from '../services/legacy-inventory-data.service';
import { legacyTrim } from '../transforms/legacy-values';
import type { MigrationStageName, StageRunReport } from '../types';
import { maybeCreateInventoryOpeningJournal } from '../services/migration-inventory-opening-je.service';
import { importHistoricalStocktaking } from '../services/migration-inventory-stocktaking.service';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';

const STAGE: MigrationStageName = 'INVENTORY';
export const INVENTORY_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION', 'ITEMS'];

export interface InventoryAnalyzeResult {
  invoiceStockLines: number;
  storeTransLines: number;
  storeCollLines: number;
  postedStocktake: number;
  itemCostRows: number;
  itemStoreRows: number;
  quantitySource: string;
}

export interface InventoryReconcileResult {
  importedMovements: number;
  plannedImportable: number;
  quarantined: number;
  skipped: number;
  missingItem: number;
  missingWarehouse: number;
  /** Posted stock-affecting invoice lines whose document type has no stock direction. */
  unknownTypeLines?: number;
  duplicateSourceIdentities: number;
  quantityByItemWarehouse: Array<{
    itemCode: string;
    warehouseCode: string;
    expectedQuantity: string;
    importedQuantity: string;
    difference: string;
  }>;
  quantityDifferenceCount: number;
  valuationGaps: Array<{ itemCode: string; warehouseCode: string; quantity: string; reason: string }>;
  inventoryGlPosted: { debit: string; credit: string; accountCodes: string[] };
  inventorySubledgerValue: string;
  inventoryGlPolicy: string;
  quarantinedImpact: Array<{ itemCode: string; type: string; docNum: string; quantity: string; amount: string }>;
  journalCount: number;
}

type PlannedMovement = {
  identity: Record<string, string>;
  row: LegacyStockMovementRow;
  warehouseCode: string;
  quantityDelta: Decimal;
  unitCost: Decimal | null;
  movementType: string;
  alreadyMapped: boolean;
};

export async function analyzeInventory(ctx: MigrationContext): Promise<InventoryAnalyzeResult> {
  const [invoices, trans, coll, stocktake, costs] = await Promise.all([
    loadPostedInvoiceStockLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreTransLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreCollLines(ctx.source, ctx.legacyCompanyCode),
    countPostedStocktake(ctx.source, ctx.legacyCompanyCode),
    loadLegacyItemCosts(ctx.source, ctx.legacyCompanyCode),
  ]);
  return {
    invoiceStockLines: invoices.filter((r) => r.posted && !r.deleted && r.affectStore).length,
    storeTransLines: trans.filter((r) => r.posted && !r.deleted).length,
    storeCollLines: coll.filter((r) => r.posted && !r.deleted).length,
    postedStocktake: stocktake,
    itemCostRows: costs.length,
    itemStoreRows: 0,
    quantitySource: 'INVOICE_AFFECTSTORE_PLUS_STORETRANS_PLUS_STORECOLL',
  };
}

export async function runInventoryStage(ctx: MigrationContext): Promise<StageRunReport> {
  const analysis = await analyzeInventory(ctx);
  await ctx.issues.recordOnce({
    jobId: ctx.migrationJobId,
    stage: STAGE,
    severity: 'INFO',
    category: 'INVENTORY_POLICY',
    sourceEntity: 'ItemStore',
    sourceKey: 'ItemStore',
    description:
      'ItemStore is empty and is not treated as stock. Quantity is reconstructed from posted AffectStore invoices, StoreTrans ST01, and posted StoreColl. Opening ItemsFirstTime is empty. Historical GL is not regenerated.',
  });
  if (analysis.postedStocktake === 0) {
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      severity: 'INFO',
      category: 'STOCKTAKE_SKIPPED',
      sourceEntity: 'StoreCheckHeader',
      sourceKey: 'StoreCheckHeader',
      description: 'No posted+performed stocktake; StoreCheck is not imported as a movement.',
    });
  }
  await ctx.issues.recordOnce({
    jobId: ctx.migrationJobId,
    stage: STAGE,
    severity: 'INFO',
    category: 'INVENTORY_GL_POLICY_PERIODIC',
    sourceEntity: 'Account',
    sourceKey: '301001',
    description:
      'Posted purchases debit 301001 مشتريات; sales credit 401001. Unique posted details for 10205001/10203001/304001 are empty. Legacy accounting is periodic purchases/sales, not perpetual inventory. Opening inventory valuation journals are not created.',
  });

  const cp = await ctx.checkpoints.load(ctx.migrationJobId, STAGE, 'InventoryMovement');
  if (cp?.cursorKey === '__DONE__') {
    return {
      stage: STAGE,
      sourceCounts: { ...analysis },
      transformed: 0,
      written: 0,
      simulated: 0,
      warnings: 0,
      errors: 0,
      blockers: 0,
    };
  }

  const planned = await planMovements(ctx);
  let written = Number(cp?.successCount ?? 0n);
  let simulated = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;
  const startFrom = cp?.cursorKey && cp.cursorKey !== '__DONE__' ? cp.cursorKey : null;

  for (const plan of planned) {
    const cursor = movementIdentityCursor(plan);
    if (startFrom && cursor <= startFrom) {
      continue;
    }
    processed += 1;
    if (plan.alreadyMapped) {
      skipped += 1;
      continue;
    }
    const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: plan.row.itemCode,
    });
    const whMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
      companyCode: ctx.legacyCompanyCode,
      storeCode: plan.warehouseCode,
    });
    const typeKnown = plan.row.family !== 'INV' || invoiceStockSign(plan.row.type) !== null;
    const factor = conversionFactor(plan.row.change);
    const decision = decidePostedStockDocument({
      isPosted: plan.row.posted,
      isDeleted: plan.row.deleted,
      alreadyMapped: false,
      affectStore: plan.row.affectStore,
      itemResolved: Boolean(itemMap),
      warehouseResolved: Boolean(whMap && plan.warehouseCode),
      typeKnown,
      factorOk: factor.gt(0),
    });
    if (decision.decision.startsWith('SKIP_')) {
      skipped += 1;
      continue;
    }
    if (decision.decision !== 'IMPORT') {
      errors += 1;
      const qty = plan.quantityDelta;
      const amount = plan.unitCost ? qty.abs().mul(plan.unitCost) : money(plan.row.price).mul(qty.abs());
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'ERROR',
        category: decision.decision,
        sourceEntity: plan.row.family,
        sourceKey: `${plan.row.family}|${plan.row.yearId}|${plan.row.type}|${plan.row.docNum}|${plan.row.itemCode}|${plan.identity.leg}`,
        description: `${decision.reason}; item=${plan.row.itemCode} store=${plan.warehouseCode || '(blank)'} type=${plan.row.type} qty=${money2(qty)} amount=${money2(amount)} classification=UNRESOLVABLE`,
      });
      continue;
    }
    if (ctx.dryRun) {
      simulated += 1;
      continue;
    }
    const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
      companyCode: ctx.legacyCompanyCode,
      branchCode: plan.row.branchCode,
    });
    const created = await ctx.prisma.inventoryMovement.create({
      data: {
        companyId: ctx.targetCompanyId,
        branchId: branchMap?.targetId ?? null,
        warehouseId: whMap!.targetId,
        itemId: itemMap!.targetId,
        quantityDelta: plan.quantityDelta.toFixed(4),
        unitCost: plan.unitCost ? plan.unitCost.toFixed(4) : null,
        resultingAverageCost: null,
        movementType: clipRef(plan.movementType, 30),
        sourceType: clipRef(plan.row.type, 30),
        sourceNumber: clipRef(plan.row.docNum, 30),
        sourceYearId: clipRef(plan.row.yearId, 20),
        sourceDocumentId: compactSourceDocumentId(plan),
        documentDate: plan.row.date,
        effectiveAt: plan.row.date,
      },
    });
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'InventoryMovement',
      sourceKeyParts: plan.identity,
      targetModel: 'InventoryMovement',
      targetId: created.id,
      outcome: 'CREATED_BY_MIGRATION',
      readOnly: true,
    });
    const snapCfg = inventorySnapshotConfig(plan.row.family);
    if (snapCfg) {
      await preserveLegacySnapshot(ctx, {
        namespace: snapCfg.preserveNamespace,
        sourceKey: movementIdentityCursor(plan),
        raw: plan.row as unknown as Record<string, unknown>,
        mappedColumns: snapCfg.mappedColumns,
      });
    }
    written += 1;
    if (written % 25 === 0) {
      await ctx.throwIfPaused({ stage: STAGE, entity: 'InventoryMovement' });
      await saveCheckpoint(ctx, cursor, processed, written, errors);
    }
    const failAfter = Number(process.env.MIGRATION_TEST_FAIL_INVENTORY_AFTER ?? '');
    if (Number.isFinite(failAfter) && failAfter > 0 && written >= failAfter) {
      await saveCheckpoint(ctx, cursor, processed, written, errors);
      throw new Error(`MIGRATION_TEST_SIMULATED_FAILURE:INVENTORY:${written}`);
    }
  }

  if (!ctx.dryRun) {
    await rebuildBalances(ctx);
    await importItemCosts(ctx);
    await saveCheckpoint(ctx, '__DONE__', processed, written, errors);
  }

  const stocktaking = await importHistoricalStocktaking(ctx);
  const openingJe = await maybeCreateInventoryOpeningJournal(ctx);

  return {
    stage: STAGE,
    sourceCounts: { ...analysis, skipped, stocktakingWritten: stocktaking.written, openingJeStatus: openingJe.status },
    transformed: planned.length,
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings: 0,
    errors,
    blockers: 0,
  };
}

async function planMovements(ctx: MigrationContext): Promise<PlannedMovement[]> {
  const [invoices, trans, coll, checkVar, adjust] = await Promise.all([
    loadPostedInvoiceStockLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreTransLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreCollLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreCheckDetailLines(ctx.source, ctx.legacyCompanyCode),
    loadPostedStoreAdjustDetailLines(ctx.source, ctx.legacyCompanyCode),
  ]);
  const planned: PlannedMovement[] = [];
  for (const row of invoices) {
    const sign = invoiceStockSign(row.type) ?? 0;
    const qty = baseQuantity(row.qty1, row.qty2).mul(sign);
    const cost = money(row.costPrice);
    planned.push(await toPlan(ctx, row, row.warehouseCode, qty, cost.gt(0) ? cost : null, invoiceMovementType(row.type)));
  }
  for (const row of trans) {
    const qty = transferQuantity(row.transMainQty, row.transQty, row.qty);
    const cost = money(row.price);
    const unitCost = cost.gt(0) ? cost : null;
    planned.push(await toPlan(ctx, row, row.warehouseCode, qty.neg(), unitCost, 'TRANSFER_OUT', 'OUT'));
    planned.push(await toPlan(ctx, row, row.otherWarehouseCode, qty, unitCost, 'TRANSFER_IN', 'IN'));
  }
  // StoreAdjustHeader is keyed by the StoreCheckCode it settles: when a performed stocktake has
  // its adjustment document, the adjustment is the stock movement and the count is not applied
  // a second time.
  const adjustedCounts = new Set(
    adjust.map((r) => [r.branchCode, r.yearId, r.docNum, r.itemCode, r.warehouseCode].join('|'))
  );
  for (const row of checkVar) {
    const qty = money(row.qty);
    if (qty.isZero()) continue;
    if (adjustedCounts.has([row.branchCode, row.yearId, row.docNum, row.itemCode, row.warehouseCode].join('|'))) {
      continue;
    }
    planned.push(
      await toPlan(ctx, row, row.warehouseCode, qty, money(row.costPrice).gt(0) ? money(row.costPrice) : null, 'STOCKTAKE_VARIANCE')
    );
  }
  for (const row of adjust) {
    const qty = money(row.qty);
    if (qty.isZero()) continue;
    planned.push(await toPlan(ctx, row, row.warehouseCode, qty, money(row.costPrice).gt(0) ? money(row.costPrice) : null, 'STORE_ADJUST'));
  }
  for (const row of coll) {
    const qty = transferQuantity(row.transMainQty, row.transQty, row.qty);
    const cost = money(row.price);
    const unitCost = cost.gt(0) ? cost : null;
    if (row.warehouseCode && row.otherWarehouseCode && row.warehouseCode === row.otherWarehouseCode) {
      const signed = money(row.qty);
      const delta = signed.isZero() ? qty : signed;
      planned.push(await toPlan(ctx, row, row.warehouseCode, delta, unitCost, collMovementType(row.type), 'SINGLE'));
      continue;
    }
    planned.push(await toPlan(ctx, row, row.warehouseCode, qty.neg(), unitCost, collMovementType(row.type) + '_OUT', 'OUT'));
    planned.push(await toPlan(ctx, row, row.otherWarehouseCode, qty, unitCost, collMovementType(row.type) + '_IN', 'IN'));
  }
  planned.sort((a, b) => movementIdentityCursor(a).localeCompare(movementIdentityCursor(b)));
  return planned;
}

async function toPlan(
  ctx: MigrationContext,
  row: LegacyStockMovementRow,
  warehouseCode: string,
  quantityDelta: Decimal,
  unitCost: Decimal | null,
  movementType: string,
  leg = 'SINGLE'
): Promise<PlannedMovement> {
  const identity = {
    companyCode: ctx.legacyCompanyCode,
    family: row.family,
    yearId: row.yearId,
    type: row.type,
    docNum: row.docNum,
    rowKey: row.rowKey,
    warehouseCode,
    leg,
    glNum: row.glNum || '',
  };
  const existing = await ctx.idMap.findMapping(ctx.migrationJobId, 'InventoryMovement', identity);
  return {
    identity,
    row: { ...row, warehouseCode },
    warehouseCode,
    quantityDelta,
    unitCost,
    movementType,
    alreadyMapped: Boolean(existing),
  };
}

function invoiceMovementType(type: string): string {
  const sign = invoiceStockSign(type);
  if (type.startsWith('P') && (sign ?? 0) > 0) return 'PURCHASE';
  if (type.startsWith('P') && (sign ?? 0) < 0) return 'PURCHASE_RETURN';
  if (type.startsWith('S') && (sign ?? 0) < 0) return 'SALE';
  if (type.startsWith('S') && (sign ?? 0) > 0) return 'SALE_RETURN';
  return `LEGACY_${type}`;
}

function collMovementType(type: string): string {
  if (type === 'SI01') return 'STORE_ISSUE';
  if (type === 'SL01') return 'STORE_LOAD';
  return `LEGACY_${type}`;
}

function movementIdentityCursor(plan: PlannedMovement): string {
  return [
    plan.row.date.toISOString(),
    plan.row.family,
    plan.row.yearId,
    plan.row.type,
    plan.row.docNum,
    plan.row.rowKey,
    plan.warehouseCode,
    plan.identity.leg,
  ].join('|');
}

function clipRef(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function compactSourceDocumentId(plan: PlannedMovement): string {
  const raw = [
    plan.row.family,
    plan.row.yearId,
    plan.row.type,
    plan.row.docNum,
    plan.row.rowKey,
    plan.identity.leg,
    plan.row.glNum,
  ].join(':');
  if (raw.length <= 80) return raw;
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return clipRef(`${plan.row.family}:${plan.row.type}:${plan.row.docNum}:${hash}`, 80);
}

async function saveCheckpoint(
  ctx: MigrationContext,
  cursorKey: string,
  processed: number,
  written: number,
  errors: number
) {
  if (ctx.dryRun) return;
  await ctx.checkpoints.save({
    jobId: ctx.migrationJobId,
    stage: STAGE,
    entity: 'InventoryMovement',
    cursorKey,
    processedCount: BigInt(processed),
    successCount: BigInt(written),
    warningCount: 0n,
    errorCount: BigInt(errors),
  });
}

async function rebuildBalances(ctx: MigrationContext) {
  const grouped = await ctx.prisma.inventoryMovement.groupBy({
    by: ['itemId', 'warehouseId'],
    where: { companyId: ctx.targetCompanyId },
    _sum: { quantityDelta: true },
  });
  if (!grouped.length) return;
  for (const row of grouped) {
    await ctx.prisma.itemWarehouseBalance.upsert({
      where: {
        companyId_itemId_warehouseId: {
          companyId: ctx.targetCompanyId,
          itemId: row.itemId,
          warehouseId: row.warehouseId,
        },
      },
      update: { quantityOnHand: money(row._sum.quantityDelta ?? 0).toFixed(4) },
      create: {
        companyId: ctx.targetCompanyId,
        itemId: row.itemId,
        warehouseId: row.warehouseId,
        quantityOnHand: money(row._sum.quantityDelta ?? 0).toFixed(4),
        averageCost: 0,
      },
    });
  }
}

async function importItemCosts(ctx: MigrationContext) {
  const rows = await loadLegacyItemCosts(ctx.source, ctx.legacyCompanyCode);
  const defaultBranch = await ctx.prisma.branch.findFirst({
    where: { companyId: ctx.targetCompanyId },
    select: { id: true },
  });
  if (!defaultBranch) return;
  for (const row of rows) {
    const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: legacyTrim(row.ItemCode),
    });
    if (!itemMap) continue;
    const sourceType = clipRef(legacyTrim(row.SourceType) || 'LEGACY', 30);
    const sourceNumber = clipRef(legacyTrim(row.SourceNum) || legacyTrim(row.Serial) || '0', 30);
    const sourceYearId = clipRef(legacyTrim(row.SourceYearId) || '00000000', 20);
    const existing = await ctx.prisma.itemCostHistory.findFirst({
      where: {
        companyId: ctx.targetCompanyId,
        itemId: itemMap.targetId,
        sourceType,
        sourceNumber,
        sourceYearId,
      },
    });
    if (existing) continue;
    const cost = money(row.Cost);
    if (cost.lte(0)) {
      const hasQty = await ctx.prisma.itemWarehouseBalance.findFirst({
        where: {
          companyId: ctx.targetCompanyId,
          itemId: itemMap.targetId,
          OR: [{ quantityOnHand: { gt: 0 } }, { quantityOnHand: { lt: 0 } }],
        },
        select: { id: true },
      });
      if (hasQty) {
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'WARNING',
          category: 'VALUATION_NONPOSITIVE_COST',
          sourceEntity: 'ItemCost',
          sourceKey: `${legacyTrim(row.ItemCode)}|${sourceNumber}`,
          description: 'Source ItemCost is missing or <= 0; cost was not invented.',
        });
      }
      continue;
    }
    const serialRows = await ctx.prisma.itemCostHistory.count({
      where: { companyId: ctx.targetCompanyId, itemId: itemMap.targetId },
    });
    const date = row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0));
    const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(row.BranchCode),
    });
    try {
      await ctx.prisma.itemCostHistory.create({
        data: {
          companyId: ctx.targetCompanyId,
          branchId: branchMap?.targetId ?? defaultBranch.id,
          itemId: itemMap.targetId,
          serial: serialRows + 1,
          cost: cost.toFixed(4),
          effectiveAt: date,
          documentDate: date,
          hijriDate: legacyTrim(row.DateH) || null,
          sourceType,
          sourceNumber,
          sourceYearId,
        },
      });
      await preserveLegacySnapshot(ctx, {
        namespace: IMPORTER_PRESERVE_CONFIG.ItemCost.preserveNamespace,
        sourceKey: `${legacyTrim(row.ItemCode)}|${sourceNumber}|${sourceYearId}`,
        raw: row as Record<string, unknown>,
        mappedColumns: IMPORTER_PRESERVE_CONFIG.ItemCost.mappedColumns,
      });
    } catch (err) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'WARNING',
        category: 'ITEM_COST_IMPORT_SKIPPED',
        sourceEntity: 'ItemCost',
        sourceKey: `${legacyTrim(row.ItemCode)}|${sourceNumber}|${sourceYearId}`,
        description: `ItemCost row not imported: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const purchaseCosts = await loadPostedPurchaseLineCosts(ctx.source, ctx.legacyCompanyCode);
  for (const row of purchaseCosts) {
    if (!isDefensiblePurchaseCost(legacyTrim(row.Type), row.CostPrice)) continue;
    const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
      companyCode: ctx.legacyCompanyCode,
      itemCode: legacyTrim(row.ItemCode),
    });
    if (!itemMap) continue;
    const sourceType = clipRef(legacyTrim(row.Type), 30);
    const sourceNumber = clipRef(legacyTrim(row.InvoiceNum), 30);
    const sourceYearId = clipRef(legacyTrim(row.YearID) || '00000000', 20);
    const existing = await ctx.prisma.itemCostHistory.findFirst({
      where: { companyId: ctx.targetCompanyId, itemId: itemMap.targetId, sourceType, sourceNumber, sourceYearId },
    });
    if (existing) continue;
    const serialRows = await ctx.prisma.itemCostHistory.count({
      where: { companyId: ctx.targetCompanyId, itemId: itemMap.targetId },
    });
    const date = row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0));
    const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(row.BranchCode),
    });
    try {
      await ctx.prisma.itemCostHistory.create({
        data: {
          companyId: ctx.targetCompanyId,
          branchId: branchMap?.targetId ?? defaultBranch.id,
          itemId: itemMap.targetId,
          serial: serialRows + 1,
          cost: money(row.CostPrice).toFixed(4),
          effectiveAt: date,
          documentDate: date,
          hijriDate: legacyTrim(row.DateH) || null,
          sourceType,
          sourceNumber,
          sourceYearId,
        },
      });
    } catch (err) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'WARNING',
        category: 'ITEM_COST_IMPORT_SKIPPED',
        sourceEntity: 'InvoiceTrxDetail',
        sourceKey: `${legacyTrim(row.ItemCode)}|${sourceNumber}|${sourceYearId}`,
        description: `Purchase CostPrice not imported: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const balances = await ctx.prisma.itemWarehouseBalance.findMany({
    where: { companyId: ctx.targetCompanyId },
  });
  for (const balance of balances) {
    const latest = await ctx.prisma.itemCostHistory.findFirst({
      where: { companyId: ctx.targetCompanyId, itemId: balance.itemId },
      orderBy: [{ effectiveAt: 'desc' }, { serial: 'desc' }],
    });
    if (!latest) continue;
    await ctx.prisma.itemWarehouseBalance.update({
      where: { id: balance.id },
      data: { averageCost: latest.cost },
    });
  }
}

export async function reconcileInventory(ctx: MigrationContext): Promise<InventoryReconcileResult> {
  const issues = await ctx.prisma.migrationIssue.findMany({
    where: { migrationJobId: ctx.migrationJobId, stage: STAGE, category: { startsWith: 'QUARANTINE' } },
  });
  const planned = await planMovements(ctx);
  const identityCounts = new Map<string, number>();
  for (const plan of planned) {
    const key = JSON.stringify(plan.identity);
    identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1);
  }
  const items = await ctx.prisma.item.findMany({
    where: { companyId: ctx.targetCompanyId },
    select: { id: true, serial: true },
  });
  const warehouses = await ctx.prisma.warehouse.findMany({
    where: { companyId: ctx.targetCompanyId },
    select: { id: true, legacyStoreCode: true, inventoryAccountId: true },
  });
  const itemCode = new Map(items.map((i) => [i.id, i.serial ?? i.id]));
  const itemIdByCode = new Map(items.map((i) => [i.serial ?? '', i.id]));
  const whCode = new Map(warehouses.map((w) => [w.id, w.legacyStoreCode ?? w.id]));
  const whIdByCode = new Map(warehouses.map((w) => [w.legacyStoreCode ?? '', w.id]));
  const expected = new Map<string, Decimal>();
  let plannedImportable = 0;
  let missingItem = 0;
  let missingWarehouse = 0;
  let unknownTypeLines = 0;
  const quarantinedImpact: InventoryReconcileResult['quarantinedImpact'] = [];
  for (const plan of planned) {
    const typeKnown = plan.row.family !== 'INV' || invoiceStockSign(plan.row.type) !== null;
    const factor = conversionFactor(plan.row.change);
    if (plan.row.posted && !plan.row.deleted && plan.row.affectStore && !typeKnown) unknownTypeLines += 1;
    if (!plan.row.posted || plan.row.deleted || !plan.row.affectStore || !typeKnown || !factor.gt(0)) continue;
    plannedImportable += 1;
    const itemId = itemIdByCode.get(plan.row.itemCode);
    const warehouseId = whIdByCode.get(plan.warehouseCode);
    if (!itemId) missingItem += 1;
    if (!plan.warehouseCode || !warehouseId) {
      missingWarehouse += 1;
      const amount = plan.unitCost ? plan.quantityDelta.abs().mul(plan.unitCost) : money(plan.row.price).mul(plan.quantityDelta.abs());
      quarantinedImpact.push({
        itemCode: plan.row.itemCode,
        type: plan.row.type,
        docNum: plan.row.docNum,
        quantity: money2(plan.quantityDelta),
        amount: money2(amount),
      });
    }
    if (!itemId || !warehouseId) continue;
    const key = `${plan.row.itemCode}|${plan.warehouseCode}`;
    expected.set(key, (expected.get(key) ?? money(0)).add(plan.quantityDelta));
  }
  const grouped = await ctx.prisma.inventoryMovement.groupBy({
    by: ['itemId', 'warehouseId'],
    where: { companyId: ctx.targetCompanyId },
    _sum: { quantityDelta: true },
  });
  const importedQty = new Map<string, Decimal>();
  for (const row of grouped) {
    const key = `${itemCode.get(row.itemId) ?? row.itemId}|${whCode.get(row.warehouseId) ?? row.warehouseId}`;
    importedQty.set(key, money(row._sum.quantityDelta ?? 0));
  }
  const keys = new Set([...expected.keys(), ...importedQty.keys()]);
  const costs = await ctx.prisma.itemCostHistory.findMany({
    where: { companyId: ctx.targetCompanyId },
    orderBy: { effectiveAt: 'desc' },
  });
  const latestCost = new Map<string, Decimal>();
  for (const row of costs) {
    if (!latestCost.has(row.itemId)) latestCost.set(row.itemId, money(row.cost));
  }
  const valuationGaps: InventoryReconcileResult['valuationGaps'] = [];
  const quantityByItemWarehouse: InventoryReconcileResult['quantityByItemWarehouse'] = [];
  let quantityDifferenceCount = 0;
  let subledger = money(0);
  for (const key of [...keys].sort()) {
    const [item, warehouse] = key.split('|');
    const expectedQuantity = expected.get(key) ?? money(0);
    const importedQuantity = importedQty.get(key) ?? money(0);
    const difference = importedQuantity.sub(expectedQuantity);
    if (!difference.isZero()) quantityDifferenceCount += 1;
    quantityByItemWarehouse.push({
      itemCode: item,
      warehouseCode: warehouse,
      expectedQuantity: money2(expectedQuantity),
      importedQuantity: money2(importedQuantity),
      difference: money2(difference),
    });
    const itemId = itemIdByCode.get(item);
    if (!importedQuantity.isZero() && itemId && !latestCost.has(itemId)) {
      valuationGaps.push({
        itemCode: item,
        warehouseCode: warehouse,
        quantity: money2(importedQuantity),
        reason: 'Non-zero quantity with no ItemCost or purchase CostPrice history; cost not invented',
      });
    } else if (importedQuantity.lt(0) && itemId && latestCost.has(itemId)) {
      valuationGaps.push({
        itemCode: item,
        warehouseCode: warehouse,
        quantity: money2(importedQuantity),
        reason:
          'Negative operational quantity. Purchase CostPrice is recorded as a cost trail only; not a signed-off inventory asset value',
      });
      subledger = subledger.add(importedQuantity.mul(latestCost.get(itemId)!));
    } else if (itemId && latestCost.has(itemId)) {
      subledger = subledger.add(importedQuantity.mul(latestCost.get(itemId)!));
    }
  }
  const accountIds = [...new Set(warehouses.map((w) => w.inventoryAccountId).filter((id): id is string => Boolean(id)))];
  const extraAccounts = await ctx.prisma.account.findMany({
    where: { companyId: ctx.targetCompanyId, code: { in: ['10205001', '10203001', '304001'] } },
    select: { id: true, code: true },
  });
  for (const acc of extraAccounts) {
    if (!accountIds.includes(acc.id)) accountIds.push(acc.id);
  }
  const glAccounts = await ctx.prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true },
  });
  const gl = accountIds.length
    ? await ctx.prisma.journalEntryLine.aggregate({
        where: {
          accountId: { in: accountIds },
          journalEntry: { companyId: ctx.targetCompanyId, isPosted: true, isCancelled: false },
        },
        _sum: { debitBase: true, creditBase: true },
      })
    : { _sum: { debitBase: null, creditBase: null } };
  const journalCount = await ctx.prisma.journalEntry.count({ where: { companyId: ctx.targetCompanyId } });
  const importedMovements = await ctx.prisma.inventoryMovement.count({ where: { companyId: ctx.targetCompanyId } });
  return {
    importedMovements,
    plannedImportable,
    quarantined: issues.length,
    skipped: planned.filter((p) => !p.row.posted || p.row.deleted || !p.row.affectStore).length,
    missingItem,
    missingWarehouse,
    unknownTypeLines,
    duplicateSourceIdentities: [...identityCounts.values()].filter((n) => n > 1).length,
    quantityByItemWarehouse,
    quantityDifferenceCount,
    valuationGaps,
    inventoryGlPosted: {
      debit: money2(money(gl._sum.debitBase ?? 0)),
      credit: money2(money(gl._sum.creditBase ?? 0)),
      accountCodes: glAccounts.map((a) => a.code),
    },
    inventorySubledgerValue: money2(subledger),
    inventoryGlPolicy: 'PERIODIC_PURCHASES_SALES',
    quarantinedImpact,
    journalCount,
  };
}

function inventorySnapshotConfig(family: string) {
  switch (family) {
    case 'ST':
      return IMPORTER_PRESERVE_CONFIG.StoreTransDetail;
    case 'SC':
      return IMPORTER_PRESERVE_CONFIG.StoreCollDetail;
    case 'SK':
      return IMPORTER_PRESERVE_CONFIG.StoreCheckDetail;
    case 'SA':
      return IMPORTER_PRESERVE_CONFIG.StoreAdjustDetail;
    case 'INV':
      return IMPORTER_PRESERVE_CONFIG.InvoiceTrxDetail;
    default:
      return null;
  }
}
