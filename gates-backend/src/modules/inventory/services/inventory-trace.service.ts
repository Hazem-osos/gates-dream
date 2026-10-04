import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';

type Tx = Prisma.TransactionClient;

/**
 * Shared serial and lot balances. A POS line that does not name a serial or
 * batch does not touch these tables. Document numbering stays on serial_numbers.
 */
export async function applyInventoryTrace(
  tx: Tx,
  params: {
    companyId: string;
    itemId: string;
    warehouseId: string;
    quantity: number;
    lineId: string;
    batchNumber?: string | null;
    expiryDate?: Date | null;
    serialNo?: string | null;
    direction: 'OUT' | 'IN';
  }
) {
  const serial = params.serialNo?.trim();
  if (serial) {
    const row = await tx.inventoryItemSerial.findFirst({
      where: { companyId: params.companyId, itemId: params.itemId, serial },
    });
    if (params.direction === 'OUT') {
      if (!row || row.status !== 'AVAILABLE') {
        throw new AppError(422, 'Serial number is not available');
      }
      const claim = await tx.inventoryItemSerial.updateMany({
        where: { id: row.id, status: 'AVAILABLE' },
        data: { status: 'SOLD', posOrderLineId: params.lineId, warehouseId: params.warehouseId },
      });
      if (claim.count !== 1) throw new AppError(409, 'Serial number was sold by another request');
    } else {
      if (!row || row.status !== 'SOLD' || row.posOrderLineId !== params.lineId) {
        throw new AppError(422, 'Serial number is not on this sale');
      }
      await tx.inventoryItemSerial.update({
        where: { id: row.id },
        data: { status: 'AVAILABLE', posOrderLineId: null },
      });
    }
  }

  const batch = params.batchNumber?.trim();
  if (!batch) return;
  const lot = await tx.inventoryItemLot.findFirst({
    where: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      batchNumber: batch,
    },
  });
  if (params.direction === 'OUT') {
    if (!lot || Number(lot.quantity) + 0.0001 < params.quantity) {
      throw new AppError(422, 'Batch quantity is not available');
    }
    const next = Number(lot.quantity) - params.quantity;
    const claim = await tx.inventoryItemLot.updateMany({
      where: { id: lot.id, quantity: { gte: params.quantity } },
      data: { quantity: next },
    });
    if (claim.count !== 1) throw new AppError(409, 'Batch quantity changed during the sale');
    return;
  }
  if (lot) {
    await tx.inventoryItemLot.update({
      where: { id: lot.id },
      data: { quantity: { increment: params.quantity } },
    });
    return;
  }
  await tx.inventoryItemLot.create({
    data: {
      companyId: params.companyId,
      itemId: params.itemId,
      warehouseId: params.warehouseId,
      batchNumber: batch,
      expiryDate: params.expiryDate,
      quantity: params.quantity,
    },
  });
}
