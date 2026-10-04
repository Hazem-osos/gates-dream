import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService, isLegacyTrue } from '../../platform/services/company-setting.service';
import { strictInventoryFromFlags } from './strict-inventory';

export { strictInventoryFromFlags } from './strict-inventory';

export type AdjustStockInput = {
  companyId: string;
  itemId: string;
  warehouseId: string;
  deltaQty?: number;
  deltaReserved?: number;
};

export type WarehouseStockBalance = {
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  /** Warehouse moving-average from `item_warehouse_balances`. */
  averageCost: number;
};

type SettingsClient = {
  companySettings: {
    findUnique: (args: {
      where: { companyId: string };
      select: { allowNegativeBalance: true; preventNegativeStock: true };
    }) => Promise<{
      allowNegativeBalance: boolean | null;
      preventNegativeStock?: boolean | null;
    } | null>;
  };
};

export async function isStrictInventory(
  companyId: string,
  db: SettingsClient = prisma
): Promise<boolean> {
  const settings = await db.companySettings.findUnique({
    where: { companyId },
    select: { allowNegativeBalance: true, preventNegativeStock: true },
  });
  const readFlag = async (name: string) => {
    if ((db as unknown) === (prisma as unknown)) return companySettingService.getFlag(companyId, name, false);
    const row = await (db as unknown as Prisma.TransactionClient).companySettingEntry.findFirst({
      where: { companyId, branchId: null, name },
      select: { value: true },
    });
    return row ? isLegacyTrue(row.value) : false;
  };
  const [legacyAllowNegativeStore, legacyAllowMinusQty] = await Promise.all([
    readFlag('AllowNegativeStore'),
    readFlag('AllowMinusQty'),
  ]);
  return strictInventoryFromFlags({
    allowNegativeBalance: settings?.allowNegativeBalance,
    allowNegativeStore: legacyAllowNegativeStore,
    allowMinusQty: legacyAllowMinusQty,
    preventNegativeStock: settings?.preventNegativeStock,
  });
}

/**
 * Atomic warehouse-level stock mutation (same TX as the stock movement / invoice / receipt).
 * Uses MySQL `INSERT … ON DUPLICATE KEY UPDATE` on `(companyId, itemId, warehouseId)`.
 *
 * `deltaQty` must only be applied via `stockMovementService.postMovementInTx` so
 * `inventory_movements`, `item_quantities`, and `item_warehouse_balances` stay aligned.
 * Use `deltaReserved` only for item reservations (no on-hand movement row).
 */
/** Serializes the first insert of a warehouse balance so two posts cannot both miss the row lock. */
export async function lockWarehouseBalanceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string
): Promise<void> {
  if (!companyId) {
    throw new AppError(400, 'معرّف الشركة مطلوب');
  }
  await tx.$queryRaw`
    SELECT id FROM item_warehouse_balances
    WHERE companyId = ${companyId}
      AND itemId = ${itemId}
      AND warehouseId = ${warehouseId}
    FOR UPDATE
  `;
}

export async function adjustStockInTx(
  tx: Prisma.TransactionClient,
  input: AdjustStockInput
): Promise<WarehouseStockBalance> {
  if (!input.companyId) {
    throw new AppError(400, 'معرّف الشركة مطلوب');
  }

  const deltaQty = Number(input.deltaQty ?? 0);
  const deltaReserved = Number(input.deltaReserved ?? 0);

  const locked = await tx.$queryRaw<Array<{ quantityOnHand: unknown; reservedQuantity: unknown }>>`
    SELECT quantityOnHand, reservedQuantity
    FROM item_warehouse_balances
    WHERE companyId = ${input.companyId}
      AND itemId = ${input.itemId}
      AND warehouseId = ${input.warehouseId}
    FOR UPDATE
  `;
  const currentOnHand = locked[0] ? Number(locked[0].quantityOnHand) : 0;
  const currentReserved = locked[0] ? Number(locked[0].reservedQuantity) : 0;

  if (deltaQty < 0 || deltaReserved < 0) {
    const strict = await isStrictInventory(input.companyId, tx);
    if (strict && currentOnHand + deltaQty < 0) {
      throw new AppError(
        422,
        `Negative stock not allowed for item ${input.itemId} in warehouse ${input.warehouseId}`
      );
    }
    if (strict && currentReserved + deltaReserved < 0) {
      throw new AppError(
        422,
        `Reserved quantity cannot be negative for item ${input.itemId} in warehouse ${input.warehouseId}`
      );
    }
  }

  if (deltaQty !== 0 || deltaReserved !== 0) {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO item_warehouse_balances
        (id, companyId, itemId, warehouseId, quantityOnHand, reservedQuantity, updatedAt)
      VALUES
        (${id}, ${input.companyId}, ${input.itemId}, ${input.warehouseId},
         ${deltaQty}, ${deltaReserved}, NOW(3))
      ON DUPLICATE KEY UPDATE
        quantityOnHand = quantityOnHand + ${deltaQty},
        reservedQuantity = reservedQuantity + ${deltaReserved},
        updatedAt = NOW(3)
    `;
  }

  const quantityOnHand = currentOnHand + deltaQty;
  const reservedQuantity = currentReserved + deltaReserved;
  const after = await tx.itemWarehouseBalance.findUnique({
    where: {
      companyId_itemId_warehouseId: {
        companyId: input.companyId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
      },
    },
    select: { averageCost: true },
  });
  return {
    quantityOnHand,
    reservedQuantity,
    availableQuantity: quantityOnHand - reservedQuantity,
    averageCost: after ? Number(after.averageCost) : 0,
  };
}

export async function getWarehouseBalance(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  itemId: string,
  warehouseId: string
): Promise<WarehouseStockBalance> {
  const row = await db.itemWarehouseBalance.findUnique({
    where: {
      companyId_itemId_warehouseId: { companyId, itemId, warehouseId },
    },
  });
  const quantityOnHand = row ? Number(row.quantityOnHand) : 0;
  const reservedQuantity = row ? Number(row.reservedQuantity) : 0;
  const averageCost = row ? Number(row.averageCost) : 0;
  return {
    quantityOnHand,
    reservedQuantity,
    availableQuantity: quantityOnHand - reservedQuantity,
    averageCost,
  };
}
