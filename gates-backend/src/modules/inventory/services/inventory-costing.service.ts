import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemCostService } from './item-cost.service';
import { stockMovementService } from './stock-movement.service';
import { getWarehouseBalance } from './adjust-stock-in-tx';
import {
  applyInboundToState,
  applyOutboundToState,
  computeGlobalAverageCost,
  replayItemCostHistory,
  type CostingMovementType,
} from './inventory-costing-math';

export interface CostingMovementInput {
  companyId: string;
  branchId?: string;
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  quantity: number;
  unitCost?: number;
  change?: number;
  movementType: CostingMovementType | string;
  sourceType?: string;
  sourceNumber?: string;
  sourceYearId?: string;
  sourceDocumentId?: string;
  transactionDate: Date;
  hijriDate?: string;
  /** When false, caller already posted the stock ledger row. */
  postStock?: boolean;
  /** Override company negative-stock policy. `undefined` = company setting. */
  allowNegativeStock?: boolean;
  /** SALE_RETURN / restore: average in at the current MAC, never a selling price. */
  inheritCurrentCost?: boolean;
  /** Default true for genuine purchases; false for transfers / assembly / returns. */
  updateLastPurchasePrice?: boolean;
}

export interface InboundMovementResult {
  unitCost: number;
  inboundQty: number;
  previousQty: number;
  previousAverageCost: number;
  resultingAverageCost: number;
  quantityOnHand: number;
  globalAverageCost: number;
  totalValuation: number;
  movementId?: string;
}

export interface OutboundMovementResult {
  unitCost: number;
  totalValuation: number;
  quantityOnHand: number;
  averageCost: number;
  movementId?: string;
}

export interface RecalculateItemCostHistoryInput {
  companyId: string;
  itemId?: string;
  startDate?: Date;
  warehouseIds?: string[];
}

export interface RecalculateItemCostHistoryResult {
  items: number;
  movements: number;
  draftJournalsUpdated: number;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as Decimal).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class InventoryCostingService {
  async applyInboundMovement(
    tx: Prisma.TransactionClient,
    input: CostingMovementInput
  ): Promise<InboundMovementResult> {
    const inboundQty = Math.abs(Number(input.quantity) || 0);
    if (inboundQty <= 0) {
      const current = await this.readCostSnapshot(tx, input);
      return {
        unitCost: current.averageCost,
        inboundQty: 0,
        previousQty: current.quantity,
        previousAverageCost: current.averageCost,
        resultingAverageCost: current.averageCost,
        quantityOnHand: current.quantity,
        globalAverageCost: current.globalAverageCost,
        totalValuation: 0,
      };
    }

    const snapshot = await this.readCostSnapshot(tx, input);
    const inboundCost = input.inheritCurrentCost
      ? snapshot.averageCost
      : roundTo4((Number(input.unitCost) || 0) * (input.change ?? 1));

    const next = applyInboundToState(
      { quantity: snapshot.quantity, averageCost: snapshot.averageCost },
      inboundQty,
      inboundCost
    );

    let movementId: string | undefined;
    let quantityOnHand = snapshot.quantity + inboundQty;

    if (input.postStock !== false) {
      const posted = await stockMovementService.postMovementInTx(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        locationId: input.locationId,
        quantityDelta: inboundQty,
        unitCost: inboundCost,
        resultingAverageCost: next.averageCost,
        sourceDocumentId: input.sourceDocumentId,
        movementType: input.movementType,
        sourceType: input.sourceType,
        sourceNumber: input.sourceNumber,
        sourceYearId: input.sourceYearId,
        documentDate: input.transactionDate,
        effectiveAt: input.transactionDate,
        allowNegativeStock: input.allowNegativeStock,
      });
      movementId = posted.movement.id;
      quantityOnHand = posted.quantityOnHand;
    }

    await this.persistWarehouseAverage(tx, input, next.averageCost);
    const globalAverageCost = await this.syncItemValuation(tx, {
      companyId: input.companyId,
      itemId: input.itemId,
      inboundCost,
      updateLastPurchasePrice:
        !input.inheritCurrentCost && input.updateLastPurchasePrice !== false,
    });

    if (input.sourceType && input.sourceNumber && input.sourceYearId) {
      await itemCostService.upsertCostSnapshotInTx(tx, {
        companyId: input.companyId,
        branchId: input.branchId ?? '',
        itemId: input.itemId,
        cost: globalAverageCost,
        invoiceDate: input.transactionDate,
        sourceType: input.sourceType,
        sourceNum: input.sourceNumber,
        sourceYearId: input.sourceYearId,
        hijriDate: input.hijriDate,
      });
    }

    return {
      unitCost: inboundCost,
      inboundQty,
      previousQty: snapshot.quantity,
      previousAverageCost: snapshot.averageCost,
      resultingAverageCost: next.averageCost,
      quantityOnHand,
      globalAverageCost,
      totalValuation: roundTo4(inboundQty * inboundCost),
      movementId,
    };
  }

  async applyOutboundMovement(
    tx: Prisma.TransactionClient,
    input: CostingMovementInput
  ): Promise<OutboundMovementResult> {
    const outboundQty = Math.abs(Number(input.quantity) || 0);
    const snapshot = await this.readCostSnapshot(tx, input);
    const outbound = applyOutboundToState(
      { quantity: snapshot.quantity, averageCost: snapshot.averageCost },
      outboundQty
    );

    if (input.allowNegativeStock === false && outbound.quantityOnHand < 0) {
      await stockMovementService.assertNegativeStockAllowed(
        input.companyId,
        input.warehouseId,
        input.itemId,
        input.locationId,
        -outboundQty,
        tx
      );
    }

    let movementId: string | undefined;
    let quantityOnHand = outbound.quantityOnHand;

    if (outboundQty > 0 && input.postStock !== false) {
      const posted = await stockMovementService.postMovementInTx(tx, {
        companyId: input.companyId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        locationId: input.locationId,
        quantityDelta: -outboundQty,
        unitCost: outbound.unitCost,
        resultingAverageCost: snapshot.averageCost,
        sourceDocumentId: input.sourceDocumentId,
        movementType: input.movementType,
        sourceType: input.sourceType,
        sourceNumber: input.sourceNumber,
        sourceYearId: input.sourceYearId,
        documentDate: input.transactionDate,
        effectiveAt: input.transactionDate,
        allowNegativeStock: input.allowNegativeStock,
      });
      movementId = posted.movement.id;
      quantityOnHand = posted.quantityOnHand;
    }

    return {
      unitCost: outbound.unitCost,
      totalValuation: outbound.totalValuation,
      quantityOnHand,
      averageCost: snapshot.averageCost,
      movementId,
    };
  }

  /**
   * frmRepairCost parity: replay movements chronologically and rewrite
   * cost snapshots + warehouse/item MAC. Posted journal entries are never
   * mutated (C11); draft COGS journals for the same source document are
   * restated when the new outbound valuation is known.
   */
  async recalculateItemCostHistory(
    input: RecalculateItemCostHistoryInput
  ): Promise<RecalculateItemCostHistoryResult> {
    const itemIds = input.itemId
      ? [input.itemId]
      : await this.listItemsForRecalc(input.companyId, input.warehouseIds);

    let movements = 0;
    let draftJournalsUpdated = 0;

    for (const itemId of itemIds) {
      const result = await prisma.$transaction(
        async (tx) => this.recalculateOneItemInTx(tx, { ...input, itemId }),
        { timeout: 120_000, maxWait: 20_000 }
      );
      movements += result.movements;
      draftJournalsUpdated += result.draftJournalsUpdated;
    }

    logger.info(
      {
        companyId: input.companyId,
        items: itemIds.length,
        movements,
        draftJournalsUpdated,
      },
      'Inventory cost history recalculated'
    );

    return { items: itemIds.length, movements, draftJournalsUpdated };
  }

  private async recalculateOneItemInTx(
    tx: Prisma.TransactionClient,
    input: RecalculateItemCostHistoryInput & { itemId: string }
  ): Promise<{ movements: number; draftJournalsUpdated: number }> {
    const all = await tx.inventoryMovement.findMany({
      where: { companyId: input.companyId, itemId: input.itemId },
      orderBy: [{ documentDate: 'asc' }, { effectiveAt: 'asc' }, { createdAt: 'asc' }],
    });

    const start = input.startDate;
    const before = start ? all.filter((row) => row.documentDate < start) : [];
    const after = start ? all.filter((row) => row.documentDate >= start) : all;

    const opening = replayItemCostHistory(
      before.map((row) => ({
        warehouseId: row.warehouseId,
        quantityDelta: toNumber(row.quantityDelta),
        unitCost: toNumber(row.unitCost),
        movementType: row.movementType,
      }))
    );

    const replay = replayItemCostHistory(
      after.map((row) => ({
        warehouseId: row.warehouseId,
        quantityDelta: toNumber(row.quantityDelta),
        unitCost: toNumber(row.unitCost),
        movementType: row.movementType,
      })),
      { global: opening.global, warehouses: opening.warehouses }
    );

    const outboundByDocument = new Map<string, number>();

    for (let i = 0; i < after.length; i += 1) {
      const row = after[i];
      const line = replay.lines[i];
      await tx.inventoryMovement.update({
        where: { id: row.id },
        data: {
          unitCost: new Decimal(line.unitCost),
          resultingAverageCost: new Decimal(line.resultingAverageCost),
        },
      });

      if (!line.inbound && row.sourceDocumentId) {
        outboundByDocument.set(
          row.sourceDocumentId,
          roundTo4((outboundByDocument.get(row.sourceDocumentId) ?? 0) + line.unitCost * Math.abs(toNumber(row.quantityDelta)))
        );
      }

      if (
        line.inbound &&
        row.sourceType &&
        row.sourceNumber &&
        row.sourceYearId &&
        row.branchId
      ) {
        await itemCostService.upsertCostSnapshotInTx(tx, {
          companyId: input.companyId,
          branchId: row.branchId,
          itemId: input.itemId,
          cost: replay.global.averageCost,
          invoiceDate: row.documentDate,
          sourceType: row.sourceType,
          sourceNum: row.sourceNumber,
          sourceYearId: row.sourceYearId,
        });
      }
    }

    for (const [warehouseId, state] of Object.entries(replay.warehouses)) {
      await tx.itemWarehouseBalance.upsert({
        where: {
          companyId_itemId_warehouseId: {
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId,
          },
        },
        create: {
          companyId: input.companyId,
          itemId: input.itemId,
          warehouseId,
          quantityOnHand: new Decimal(state.quantity),
          averageCost: new Decimal(state.averageCost),
        },
        update: {
          quantityOnHand: new Decimal(state.quantity),
          averageCost: new Decimal(state.averageCost),
        },
      });
    }

    await tx.item.updateMany({
      where: { id: input.itemId, companyId: input.companyId },
      data: { averageCost: new Decimal(replay.global.averageCost) },
    });

    const draftJournalsUpdated = await this.restateDraftCogsJournals(
      tx,
      input.companyId,
      outboundByDocument
    );

    return { movements: after.length, draftJournalsUpdated };
  }

  private async restateDraftCogsJournals(
    tx: Prisma.TransactionClient,
    companyId: string,
    outboundByDocument: Map<string, number>
  ): Promise<number> {
    if (outboundByDocument.size === 0) return 0;

    const sourceIds = [...outboundByDocument.keys()].flatMap((id) => [id, `${id}:cogs`]);
    const drafts = await tx.journalEntry.findMany({
      where: {
        companyId,
        sourceId: { in: sourceIds },
        isPosted: false,
        isCancelled: false,
        deletedAt: null,
      },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });

    let updated = 0;
    for (const je of drafts) {
      const docId = je.sourceId?.endsWith(':cogs')
        ? je.sourceId.slice(0, -5)
        : je.sourceId;
      if (!docId) continue;
      const cogs = outboundByDocument.get(docId);
      if (cogs == null) continue;

      const cogsLike = je.lines.filter(
        (line) =>
          (line.description ?? '').toLowerCase().includes('cogs') ||
          (line.description ?? '').toLowerCase().includes('inventory')
      );
      if (cogsLike.length < 2) continue;

      for (const line of cogsLike) {
        if (toNumber(line.debit) > 0) {
          await tx.journalEntryLine.update({
            where: { id: line.id },
            data: { debit: new Decimal(cogs), credit: new Decimal(0) },
          });
        } else if (toNumber(line.credit) > 0) {
          await tx.journalEntryLine.update({
            where: { id: line.id },
            data: { debit: new Decimal(0), credit: new Decimal(cogs) },
          });
        }
      }
      updated += 1;
    }
    return updated;
  }

  private async listItemsForRecalc(companyId: string, warehouseIds?: string[]): Promise<string[]> {
    const rows = await prisma.inventoryMovement.findMany({
      where: {
        companyId,
        ...(warehouseIds?.length ? { warehouseId: { in: warehouseIds } } : {}),
      },
      distinct: ['itemId'],
      select: { itemId: true },
    });
    return rows.map((row) => row.itemId);
  }

  private async readCostSnapshot(
    tx: Prisma.TransactionClient,
    input: Pick<CostingMovementInput, 'companyId' | 'itemId' | 'warehouseId' | 'transactionDate'>
  ): Promise<{ quantity: number; averageCost: number; globalAverageCost: number }> {
    await tx.$queryRaw`
      SELECT id FROM item_warehouse_balances
      WHERE companyId = ${input.companyId}
        AND itemId = ${input.itemId}
        AND warehouseId = ${input.warehouseId}
      FOR UPDATE
    `;

    const [balance, item] = await Promise.all([
      getWarehouseBalance(tx, input.companyId, input.itemId, input.warehouseId),
      tx.item.findFirst({
        where: { id: input.itemId, companyId: input.companyId },
        select: { averageCost: true },
      }),
    ]);

    const warehouseRow = await tx.itemWarehouseBalance.findUnique({
      where: {
        companyId_itemId_warehouseId: {
          companyId: input.companyId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
        },
      },
      select: { averageCost: true },
    });

    const warehouseCost = toNumber(warehouseRow?.averageCost);
    const itemCost = toNumber(item?.averageCost);
    let averageCost = warehouseCost || itemCost;
    if (averageCost === 0) {
      averageCost = await itemCostService.getCostAsOf(
        input.companyId,
        input.itemId,
        input.transactionDate,
        tx
      );
    }

    return {
      quantity: balance.quantityOnHand,
      averageCost,
      globalAverageCost: itemCost || averageCost,
    };
  }

  private async persistWarehouseAverage(
    tx: Prisma.TransactionClient,
    input: Pick<CostingMovementInput, 'companyId' | 'itemId' | 'warehouseId'>,
    averageCost: number
  ): Promise<void> {
    await tx.itemWarehouseBalance.upsert({
      where: {
        companyId_itemId_warehouseId: {
          companyId: input.companyId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
        },
      },
      create: {
        companyId: input.companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        averageCost: new Decimal(averageCost),
      },
      update: { averageCost: new Decimal(averageCost) },
    });
  }

  private async syncItemValuation(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      itemId: string;
      inboundCost: number;
      updateLastPurchasePrice: boolean;
    }
  ): Promise<number> {
    const warehouses = await tx.itemWarehouseBalance.findMany({
      where: { companyId: params.companyId, itemId: params.itemId },
      select: { quantityOnHand: true, averageCost: true },
    });
    const globalAverageCost = computeGlobalAverageCost(
      warehouses.map((row) => ({
        quantityOnHand: toNumber(row.quantityOnHand),
        averageCost: toNumber(row.averageCost),
      })),
      params.inboundCost
    );

    await tx.item.updateMany({
      where: { id: params.itemId, companyId: params.companyId },
      data: {
        averageCost: new Decimal(globalAverageCost),
        ...(params.updateLastPurchasePrice
          ? { lastPurchasePrice: new Decimal(params.inboundCost) }
          : {}),
      },
    });

    return globalAverageCost;
  }
}

export const inventoryCostingService = new InventoryCostingService();
