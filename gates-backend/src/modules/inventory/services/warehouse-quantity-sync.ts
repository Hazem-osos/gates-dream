import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import {
  INVENTORY_QTY_TOLERANCE,
  planUnlocatedQuantitySync,
} from './inventory-integrity';
import { getWarehouseBalance } from './adjust-stock-in-tx';

function apart(a: number, b: number): boolean {
  return Math.abs(roundTo4(a) - roundTo4(b)) > INVENTORY_QTY_TOLERANCE;
}

/** Ledger sum must match the warehouse balance after every stock post. */
export async function assertLedgerMatchesWarehouseBalanceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  warehouseOnHand: number
): Promise<void> {
  const movementSum = await tx.inventoryMovement.aggregate({
    where: { companyId, itemId, warehouseId },
    _sum: { quantityDelta: true },
  });
  const ledger = movementSum._sum.quantityDelta?.toNumber() ?? 0;
  if (apart(warehouseOnHand, ledger)) {
    throw new AppError(
      500,
      `تعارض داخلي في المخزون: رصيد المخزن (${warehouseOnHand}) لا يطابق سجل الحركات (${ledger}) للصنف ${itemId} في المخزن ${warehouseId}`
    );
  }
}

/**
 * Align `item_quantities` with `item_warehouse_balances.quantityOnHand`.
 * Unlocated warehouses: single NULL-location row is set to the warehouse on-hand.
 * Located warehouses: the sum of location rows must already match (enforced after post).
 */
export async function syncItemQuantityToWarehouseBalanceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  warehouseOnHand: number,
  touchedLocationId?: string | null
): Promise<void> {
  const warehouse = await tx.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });
  if (!warehouse) return;

  const rows = await tx.itemQuantity.findMany({
    where: scopedItemQuantityWhere(companyId, { itemId, warehouseId }),
    select: { id: true, locationId: true, quantity: true },
  });

  const locatedRows = rows.filter((row) => row.locationId);
  const nullRows = rows.filter((row) => !row.locationId);
  const locationSum = rows.reduce((sum, row) => sum + row.quantity.toNumber(), 0);

  if (locatedRows.length === 0) {
    const plan = planUnlocatedQuantitySync({
      locatedRowCount: 0,
      nullLocationRowCount: nullRows.length,
      ledgerQty: warehouseOnHand,
    });
    if (plan.action === 'update') {
      const row = nullRows[0];
      if (row) {
        await tx.itemQuantity.update({
          where: { id: row.id },
          data: { quantity: new Decimal(plan.quantity) },
        });
      }
      return;
    }
    if (plan.action === 'create') {
      await tx.itemQuantity.create({
        data: {
          itemId,
          warehouseId,
          locationId: null,
          quantity: new Decimal(plan.quantity),
        },
      });
      return;
    }
    if (plan.action === 'noop' && nullRows.length === 1) {
      await tx.itemQuantity.update({
        where: { id: nullRows[0].id },
        data: { quantity: new Decimal(0) },
      });
    }
    return;
  }

  if (!apart(locationSum, warehouseOnHand)) return;

  const touched = touchedLocationId
    ? rows.find((row) => row.locationId === touchedLocationId)
    : undefined;
  if (touched && rows.length === 1) {
    await tx.itemQuantity.update({
      where: { id: touched.id },
      data: { quantity: new Decimal(warehouseOnHand) },
    });
    return;
  }

  if (touched) {
    const correction = roundTo4(warehouseOnHand - locationSum);
    const next = roundTo4(touched.quantity.toNumber() + correction);
    await tx.itemQuantity.update({
      where: { id: touched.id },
      data: { quantity: new Decimal(next) },
    });
    const after = rows
      .filter((row) => row.id !== touched.id)
      .reduce((sum, row) => sum + row.quantity.toNumber(), 0) + next;
    if (apart(after, warehouseOnHand)) {
      throw new AppError(
        409,
        'رصيد المواقع لا يطابق رصيد المخزن بعد الحركة. راجع توزيع الكميات على المواقع أو شغّل إعادة حساب تكلفة المخزون.'
      );
    }
    return;
  }

  throw new AppError(
    409,
    'رصيد المواقع لا يطابق رصيد المخزن. حدّد موقع التخزين في الحركة أو صحّح أرصدة المواقع.'
  );
}

/** Run after every `postMovementInTx` quantity change. */
export async function reconcileWarehouseQuantityTripleInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
  warehouseId: string,
  touchedLocationId?: string | null
): Promise<void> {
  const balance = await getWarehouseBalance(tx, companyId, itemId, warehouseId);
  await assertLedgerMatchesWarehouseBalanceInTx(
    tx,
    companyId,
    itemId,
    warehouseId,
    balance.quantityOnHand
  );
  await syncItemQuantityToWarehouseBalanceInTx(
    tx,
    companyId,
    itemId,
    warehouseId,
    balance.quantityOnHand,
    touchedLocationId
  );
}
