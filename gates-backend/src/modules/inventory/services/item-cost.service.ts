import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { stockQueryService } from './stock-query.service';
import { computeGlobalAverageCost } from './inventory-costing-math';

export interface MovingAverageInput {
  companyId: string;
  branchId: string;
  itemId: string;
  invoiceDate: Date;
  itemCount: number;
  itemPrice: number;
  sourceNum: string;
  sourceYearId: string;
  sourceType: string;
  /** Currency factor (legacy Change) */
  change?: number;
  /** PI zero-price pay-count adjustment */
  purchaseInvoicePayCount?: number;
  hijriDate?: string;
}

export interface MovingAverageResult {
  oldCost: number;
  oldItemCount: number;
  newCost: number;
  serial: number;
  effectiveAt: Date;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

function client(tx?: Prisma.TransactionClient): DbClient {
  return tx ?? prisma;
}

/**
 * Port of Delphi Tgeneral.GetItemCost (untgeneral.pas ~7791–7934).
 */
export class ItemCostService {
  computeMovingAverage(params: {
    oldCost: number;
    oldItemCount: number;
    itemCount: number;
    itemPrice: number;
    change: number;
  }): number {
    const { oldCost, oldItemCount, itemCount, itemPrice, change } = params;
    const priceFx = itemPrice * change;

    if (oldItemCount + itemCount <= 0) {
      return roundTo4(priceFx);
    }

    const weighted =
      (oldItemCount * oldCost + itemCount * priceFx) / (oldItemCount + itemCount);

    if (weighted < 0) {
      return roundTo4(priceFx);
    }

    return roundTo4(weighted);
  }

  async getCostAsOf(
    companyId: string,
    itemId: string,
    asOf: Date,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const map = await this.getCostsAsOf(companyId, [itemId], asOf, tx);
    return map.get(itemId) ?? 0;
  }

  /** Latest cost per item at `asOf` in one round-trip (invoice post hot path). */
  async getCostsAsOf(
    companyId: string,
    itemIds: string[],
    asOf: Date,
    tx?: Prisma.TransactionClient
  ): Promise<Map<string, number>> {
    const unique = [...new Set(itemIds.filter(Boolean))];
    const out = new Map<string, number>();
    if (unique.length === 0) return out;

    const db = client(tx);
    const rows = await db.itemCostHistory.findMany({
      where: {
        companyId,
        itemId: { in: unique },
        effectiveAt: { lte: asOf },
      },
      orderBy: [{ itemId: 'asc' }, { effectiveAt: 'desc' }, { serial: 'desc' }],
      select: { itemId: true, cost: true },
    });

    for (const row of rows) {
      if (!out.has(row.itemId)) {
        out.set(row.itemId, row.cost.toNumber());
      }
    }
    for (const id of unique) {
      if (!out.has(id)) out.set(id, 0);
    }
    return out;
  }

  async resolveEffectiveAt(
    companyId: string,
    itemId: string,
    sourceType: string,
    sourceNum: string,
    sourceYearId: string,
    invoiceDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<Date> {
    const db = client(tx);
    const existing = await db.itemCostHistory.findFirst({
      where: {
        companyId,
        itemId,
        sourceType,
        sourceNumber: sourceNum,
        sourceYearId,
      },
      select: { effectiveAt: true },
    });
    return existing?.effectiveAt ?? invoiceDate;
  }

  async getCompanyItemQuantityAsOfInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    asOf: Date
  ): Promise<number> {
    const movementSum = await tx.inventoryMovement.aggregate({
      where: {
        companyId,
        itemId,
        effectiveAt: { lte: asOf },
      },
      _sum: { quantityDelta: true },
    });

    if (movementSum._sum.quantityDelta != null) {
      return movementSum._sum.quantityDelta.toNumber();
    }

    const rows = await tx.itemQuantity.findMany({
      where: {
        itemId,
        warehouse: { companyId, isActive: true },
      },
      select: { quantity: true },
    });
    return rows.reduce((sum, r) => sum + r.quantity.toNumber(), 0);
  }

  async calculateMovingAverage(
    input: MovingAverageInput,
    tx?: Prisma.TransactionClient
  ): Promise<MovingAverageResult> {
    const change = input.change ?? 1;
    const effectiveAt = await this.resolveEffectiveAt(
      input.companyId,
      input.itemId,
      input.sourceType,
      input.sourceNum,
      input.sourceYearId,
      input.invoiceDate,
      tx
    );

    const oldCost = await this.getCostAsOf(
      input.companyId,
      input.itemId,
      effectiveAt,
      tx
    );

    let oldItemCount = tx
      ? await this.getCompanyItemQuantityAsOfInTx(
          tx,
          input.companyId,
          input.itemId,
          input.invoiceDate
        )
      : await stockQueryService.getCompanyItemQuantityAsOf(
          input.companyId,
          input.itemId,
          input.invoiceDate
        );

    // Movement for this receipt is already in the same transaction — use qty before this line.
    if (tx && input.itemCount > 0) {
      oldItemCount = Math.max(0, oldItemCount - input.itemCount);
    }

    if (
      input.sourceType.startsWith('PI') &&
      input.itemPrice === 0 &&
      input.purchaseInvoicePayCount
    ) {
      oldItemCount += input.purchaseInvoicePayCount;
    }

    const newCost = this.computeMovingAverage({
      oldCost,
      oldItemCount,
      itemCount: input.itemCount,
      itemPrice: input.itemPrice,
      change,
    });

    const db = client(tx);
    const maxSerial = await db.itemCostHistory.aggregate({
      where: { companyId: input.companyId, itemId: input.itemId },
      _max: { serial: true },
    });
    const serial = (maxSerial._max.serial ?? 0) + 1;

    return {
      oldCost,
      oldItemCount,
      newCost,
      serial,
      effectiveAt,
    };
  }

  async applyMovingAverage(input: MovingAverageInput) {
    return prisma.$transaction(async (tx) => this.applyMovingAverageInTx(tx, input));
  }

  async applyMovingAverageInTx(
    tx: Prisma.TransactionClient,
    input: MovingAverageInput
  ) {
    const calc = await this.calculateMovingAverage(input, tx);

    const row = await tx.itemCostHistory.upsert({
      where: {
        companyId_itemId_sourceType_sourceNumber_sourceYearId: {
          companyId: input.companyId,
          itemId: input.itemId,
          sourceType: input.sourceType,
          sourceNumber: input.sourceNum,
          sourceYearId: input.sourceYearId,
        },
      },
      create: {
        companyId: input.companyId,
        branchId: input.branchId,
        itemId: input.itemId,
        serial: calc.serial,
        cost: new Decimal(calc.newCost),
        effectiveAt: calc.effectiveAt,
        documentDate: input.invoiceDate,
        hijriDate: input.hijriDate,
        sourceType: input.sourceType,
        sourceNumber: input.sourceNum,
        sourceYearId: input.sourceYearId,
      },
      update: {
        cost: new Decimal(calc.newCost),
        effectiveAt: calc.effectiveAt,
        documentDate: input.invoiceDate,
        hijriDate: input.hijriDate,
      },
    });

    await tx.item.updateMany({
      where: { id: input.itemId, companyId: input.companyId },
      data: { averageCost: new Decimal(calc.newCost) },
    });

    return { ...calc, row };
  }

  /** Persist a pre-computed MAC snapshot (InventoryCostingService / frmRepairCost). */
  async upsertCostSnapshotInTx(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      branchId: string;
      itemId: string;
      cost: number;
      invoiceDate: Date;
      sourceType: string;
      sourceNum: string;
      sourceYearId: string;
      hijriDate?: string;
    }
  ) {
    const maxSerial = await tx.itemCostHistory.aggregate({
      where: { companyId: input.companyId, itemId: input.itemId },
      _max: { serial: true },
    });
    const serial = (maxSerial._max.serial ?? 0) + 1;

    return tx.itemCostHistory.upsert({
      where: {
        companyId_itemId_sourceType_sourceNumber_sourceYearId: {
          companyId: input.companyId,
          itemId: input.itemId,
          sourceType: input.sourceType,
          sourceNumber: input.sourceNum,
          sourceYearId: input.sourceYearId,
        },
      },
      create: {
        companyId: input.companyId,
        branchId: input.branchId,
        itemId: input.itemId,
        serial,
        cost: new Decimal(input.cost),
        effectiveAt: input.invoiceDate,
        documentDate: input.invoiceDate,
        hijriDate: input.hijriDate,
        sourceType: input.sourceType,
        sourceNumber: input.sourceNum,
        sourceYearId: input.sourceYearId,
      },
      update: {
        cost: new Decimal(input.cost),
        effectiveAt: input.invoiceDate,
        documentDate: input.invoiceDate,
        hijriDate: input.hijriDate,
      },
    });
  }

  /**
   * H9 fix — landed-cost capitalization. Injects additional value (freight,
   * customs, insurance, …) into an item's average cost WITHOUT changing
   * quantity — the mirror case of a normal receipt, which changes quantity
   * and averages in the new price. Formula:
   *   newCost = oldCost + additionalCost / onHandQty
   * which is algebraically the same as
   *   (onHandQty * oldCost + additionalCost) / onHandQty
   * i.e. the value pool grows by `additionalCost` while quantity stays
   * fixed. Returns null if nothing is currently on hand to capitalize into
   * (the goods were already fully consumed/sold before the landed cost was
   * allocated) — the caller should surface that as a warning rather than
   * silently losing the cost.
   */
  async capitalizeAdditionalCostInTx(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      branchId?: string;
      itemId: string;
      warehouseId?: string;
      asOfDate: Date;
      additionalCost: number;
      sourceNum: string;
      sourceYearId: string;
      sourceType: string;
      hijriDate?: string;
    }
  ): Promise<{
    oldCost: number;
    newCost: number;
    onHandQty: number;
    warehouseAverageCost?: number;
  } | null> {
    let onHandQty: number;
    let oldCost: number;
    let newWarehouseAverageCost: number | undefined;

    if (input.warehouseId) {
      await tx.$queryRaw`
        SELECT id FROM item_warehouse_balances
        WHERE companyId = ${input.companyId}
          AND itemId = ${input.itemId}
          AND warehouseId = ${input.warehouseId}
        FOR UPDATE
      `;
      const warehouseRow = await tx.itemWarehouseBalance.findUnique({
        where: {
          companyId_itemId_warehouseId: {
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
          },
        },
        select: { quantityOnHand: true, averageCost: true },
      });
      onHandQty = Number(warehouseRow?.quantityOnHand ?? 0);
      if (onHandQty <= 0) return null;
      const itemCost = await this.getCostAsOf(
        input.companyId,
        input.itemId,
        input.asOfDate,
        tx
      );
      oldCost = Number(warehouseRow?.averageCost) || itemCost;
      newWarehouseAverageCost = roundTo4(oldCost + input.additionalCost / onHandQty);
    } else {
      onHandQty = await this.getCompanyItemQuantityAsOfInTx(
        tx,
        input.companyId,
        input.itemId,
        input.asOfDate
      );
      if (onHandQty <= 0) return null;
      oldCost = await this.getCostAsOf(input.companyId, input.itemId, input.asOfDate, tx);
    }

    const newCost = newWarehouseAverageCost ?? roundTo4(oldCost + input.additionalCost / onHandQty);

    const maxSerial = await tx.itemCostHistory.aggregate({
      where: { companyId: input.companyId, itemId: input.itemId },
      _max: { serial: true },
    });
    const serial = (maxSerial._max.serial ?? 0) + 1;

    await tx.itemCostHistory.upsert({
      where: {
        companyId_itemId_sourceType_sourceNumber_sourceYearId: {
          companyId: input.companyId,
          itemId: input.itemId,
          sourceType: input.sourceType,
          sourceNumber: input.sourceNum,
          sourceYearId: input.sourceYearId,
        },
      },
      create: {
        companyId: input.companyId,
        branchId: input.branchId ?? '',
        itemId: input.itemId,
        serial,
        cost: new Decimal(newCost),
        effectiveAt: input.asOfDate,
        documentDate: input.asOfDate,
        hijriDate: input.hijriDate,
        sourceType: input.sourceType,
        sourceNumber: input.sourceNum,
        sourceYearId: input.sourceYearId,
      },
      update: {
        cost: new Decimal(newCost),
        effectiveAt: input.asOfDate,
        documentDate: input.asOfDate,
        hijriDate: input.hijriDate,
      },
    });

    if (input.warehouseId && newWarehouseAverageCost != null) {
      await tx.itemWarehouseBalance.update({
        where: {
          companyId_itemId_warehouseId: {
            companyId: input.companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
          },
        },
        data: { averageCost: new Decimal(newWarehouseAverageCost) },
      });

      const warehouses = await tx.itemWarehouseBalance.findMany({
        where: { companyId: input.companyId, itemId: input.itemId },
        select: { quantityOnHand: true, averageCost: true },
      });
      const globalAverageCost = computeGlobalAverageCost(
        warehouses.map((row) => ({
          quantityOnHand: Number(row.quantityOnHand),
          averageCost: Number(row.averageCost),
        })),
        newWarehouseAverageCost
      );
      await tx.item.updateMany({
        where: { id: input.itemId, companyId: input.companyId },
        data: { averageCost: new Decimal(globalAverageCost) },
      });
      return {
        oldCost,
        newCost: globalAverageCost,
        onHandQty,
        warehouseAverageCost: newWarehouseAverageCost,
      };
    }

    await tx.item.updateMany({
      where: { id: input.itemId, companyId: input.companyId },
      data: { averageCost: new Decimal(newCost) },
    });

    return { oldCost, newCost, onHandQty };
  }

  /** Remove cost rows for repost / idempotent unpost (legacy ItemCost source keys). */
  async removeCostHistoryBySourceInTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      itemId: string;
      sourceType: string;
      sourceNumber: string;
      sourceYearId: string;
    }
  ): Promise<number> {
    const result = await tx.itemCostHistory.deleteMany({
      where: {
        companyId: params.companyId,
        itemId: params.itemId,
        sourceType: params.sourceType,
        sourceNumber: params.sourceNumber,
        sourceYearId: params.sourceYearId,
      },
    });
    return result.count;
  }
}

export const itemCostService = new ItemCostService();
