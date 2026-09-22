// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { getWarehouseBalance } from './adjust-stock-in-tx';

export class ItemQuantityService {
  /**
   * Get item quantity by warehouse and location
   */
  async getItemQuantity(
    companyId: string,
    itemId: string,
    warehouseId: string,
    locationId?: string
  ) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Verify warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      if (!locationId) {
        const balance = await getWarehouseBalance(prisma, companyId, itemId, warehouseId);
        return {
          itemId,
          warehouseId,
          locationId: null,
          quantity: balance.quantityOnHand,
          quantityOnHand: balance.quantityOnHand,
          reservedQuantity: balance.reservedQuantity,
          availableQuantity: balance.availableQuantity,
          item: {
            id: item.id,
            code: item.code || null,
            serial: item.serial || null,
            arabicName: item.arabicName,
            englishName: item.englishName || null,
          },
          warehouse: {
            id: warehouse.id,
            code: warehouse.code || null,
            arabicName: warehouse.arabicName,
            englishName: warehouse.englishName || null,
          },
          location: null,
        };
      }

      const quantity = await prisma.itemQuantity.findFirst({
        where: scopedItemQuantityWhere(companyId, {
          itemId,
          warehouseId,
          locationId,
        }),
        include: {
          item: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          location: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      return quantity || {
        itemId,
        warehouseId,
        locationId,
        quantity: 0,
        item: {
          id: item.id,
          code: item.code || null,
          serial: item.serial || null,
          arabicName: item.arabicName,
          englishName: item.englishName || null,
        },
        warehouse: {
          id: warehouse.id,
          code: warehouse.code || null,
          arabicName: warehouse.arabicName,
          englishName: warehouse.englishName || null,
        },
        location: await prisma.location.findFirst({
          where: { id: locationId },
          select: {
            id: true,
            code: true,
            arabicName: true,
            englishName: true,
          },
        }),
      };
    } catch (error) {
      logger.error(
        { error, companyId, itemId, warehouseId, locationId },
        'Error getting item quantity'
      );
      throw error;
    }
  }

  /**
   * Get all quantities for an item across warehouses
   */
  async getItemQuantities(
    companyId: string,
    itemId: string,
    warehouseId?: string
  ) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const where: any = {
        itemId,
      };

      if (warehouseId) {
        // Verify warehouse belongs to company
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: warehouseId, companyId },
        });

        if (!warehouse) {
          throw new Error('Warehouse not found');
        }

        where.warehouseId = warehouseId;
      } else {
        // Filter by warehouses that belong to company
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId },
          select: { id: true },
        });
        where.warehouseId = {
          in: warehouses.map((w) => w.id),
        };
      }

      const quantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, where),
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          location: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
        orderBy: [
          { warehouse: { arabicName: 'asc' } },
          { location: { arabicName: 'asc' } },
        ],
      });

      return quantities;
    } catch (error) {
      logger.error(
        { error, companyId, itemId, warehouseId },
        'Error getting item quantities'
      );
      throw error;
    }
  }

  /**
   * Get all item quantities in a warehouse
   */
  async getWarehouseQuantities(
    companyId: string,
    warehouseId: string,
    itemId?: string
  ) {
    try {
      // Verify warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      if (itemId) {
        const item = await prisma.item.findFirst({
          where: { id: itemId, companyId },
          select: { id: true },
        });
        if (!item) {
          throw new Error('Item not found');
        }
      }

      const balances = await prisma.itemWarehouseBalance.findMany({
        where: {
          companyId,
          warehouseId,
          ...(itemId ? { itemId } : {}),
        },
        include: {
          item: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
              averageCost: true,
              lastPurchasePrice: true,
            },
          },
        },
        orderBy: { item: { arabicName: 'asc' } },
      });

      return balances.map((row) => {
        const quantityOnHand = Number(row.quantityOnHand);
        const reservedQuantity = Number(row.reservedQuantity);
        return {
          itemId: row.itemId,
          warehouseId: row.warehouseId,
          locationId: null,
          quantity: quantityOnHand,
          quantityOnHand,
          reservedQuantity,
          availableQuantity: quantityOnHand - reservedQuantity,
          item: row.item,
          warehouse: {
            id: warehouse.id,
            code: warehouse.code || null,
            arabicName: warehouse.arabicName,
            englishName: warehouse.englishName || null,
          },
          location: null,
        };
      });
    } catch (error) {
      logger.error(
        { error, companyId, warehouseId, itemId },
        'Error getting warehouse quantities'
      );
      throw error;
    }
  }

  /**
   * Get total quantity for an item across all warehouses
   */
  async getTotalItemQuantity(companyId: string, itemId: string) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const quantities = await prisma.itemWarehouseBalance.aggregate({
        where: { companyId, itemId },
        _sum: {
          quantityOnHand: true,
          reservedQuantity: true,
        },
      });

      const quantityOnHand = Number(quantities._sum.quantityOnHand || 0);
      const reservedQuantity = Number(quantities._sum.reservedQuantity || 0);

      return {
        itemId,
        totalQuantity: quantityOnHand,
        quantityOnHand,
        reservedQuantity,
        availableQuantity: quantityOnHand - reservedQuantity,
      };
    } catch (error) {
      logger.error({ error, companyId, itemId }, 'Error getting total item quantity');
      throw error;
    }
  }
}

export const itemQuantityService = new ItemQuantityService();
