import prisma from '../../../shared/database/prisma';
import { getWarehouseBalance } from './adjust-stock-in-tx';

/**
 * Instant on-hand reads from `item_warehouse_balances`.
 * As-of / historical dates still use the `inventory_movements` ledger.
 */
export class StockQueryService {
  async getCurrentCompanyItemQuantity(companyId: string, itemId: string): Promise<number> {
    const rows = await prisma.itemWarehouseBalance.findMany({
      where: {
        companyId,
        itemId,
        warehouse: { isActive: true },
      },
      select: { quantityOnHand: true },
    });
    return rows.reduce((sum, r) => sum + Number(r.quantityOnHand), 0);
  }

  async getCompanyItemQuantityAsOf(companyId: string, itemId: string, asOf: Date): Promise<number> {
    const movementSum = await prisma.inventoryMovement.aggregate({
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

    return this.getCurrentCompanyItemQuantity(companyId, itemId);
  }

  async getWarehouseQuantity(
    companyId: string,
    warehouseId: string,
    itemId: string,
    locationId?: string | null
  ): Promise<number> {
    if (locationId) {
      const row = await prisma.itemQuantity.findFirst({
        where: {
          itemId,
          warehouseId,
          locationId,
          item: { companyId },
          warehouse: { companyId },
        },
      });
      return row?.quantity.toNumber() ?? 0;
    }
    const bal = await getWarehouseBalance(prisma, companyId, itemId, warehouseId);
    return bal.quantityOnHand;
  }

  /** Warehouse-level on-hand from ItemWarehouseBalance (not a movement aggregate). */
  async getWarehouseItemStockBalance(
    companyId: string,
    itemId: string,
    warehouseId: string
  ): Promise<number> {
    const bal = await getWarehouseBalance(prisma, companyId, itemId, warehouseId);
    return bal.quantityOnHand;
  }

  async getWarehouseItemBalance(
    companyId: string,
    itemId: string,
    warehouseId: string
  ) {
    return getWarehouseBalance(prisma, companyId, itemId, warehouseId);
  }
}

export const stockQueryService = new StockQueryService();
