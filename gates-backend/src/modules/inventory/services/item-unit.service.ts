// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateItemUnitData {
  itemId: string;
  unitId: string;
  conversionFactor: number;
  isFactorFixed?: boolean;
  isBaseUnit?: boolean;
}

export interface UpdateItemUnitData {
  conversionFactor?: number;
  isFactorFixed?: boolean;
  isBaseUnit?: boolean;
}

export class ItemUnitService {
  /**
   * Create a new item unit
   */
  async createItemUnit(companyId: string, data: CreateItemUnitData) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: data.itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Verify unit belongs to company
      const unit = await prisma.unit.findFirst({
        where: { id: data.unitId, companyId },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      // If this is set as base unit, unset other base units for this item
      if (data.isBaseUnit) {
        await prisma.itemUnit.updateMany({
          where: {
            itemId: data.itemId,
            isBaseUnit: true,
          },
          data: {
            isBaseUnit: false,
          },
        });
      }

      const itemUnit = await prisma.itemUnit.create({
        data: {
          itemId: data.itemId,
          unitId: data.unitId,
          conversionFactor: new Decimal(data.conversionFactor),
          isFactorFixed: data.isFactorFixed !== false,
          isBaseUnit: data.isBaseUnit || false,
        },
        include: {
          item: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          unit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      logger.info({ companyId, itemUnitId: itemUnit.id }, 'Item unit created');
      return itemUnit;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating item unit');
      throw error;
    }
  }

  /**
   * Get item unit by ID
   */
  async getItemUnitById(companyId: string, itemUnitId: string) {
    try {
      const itemUnit = await prisma.itemUnit.findFirst({
        where: {
          id: itemUnitId,
          item: {
            companyId,
          },
        },
        include: {
          item: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          unit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!itemUnit) {
        throw new Error('Item unit not found');
      }

      return itemUnit;
    } catch (error) {
      logger.error({ error, companyId, itemUnitId }, 'Error getting item unit');
      throw error;
    }
  }

  /**
   * List item units with pagination and filters
   */
  async listItemUnits(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      itemId?: string;
      unitId?: string;
      isBaseUnit?: boolean;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        item: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { item: { arabicName: { contains: options.search } } },
          { item: { englishName: { contains: options.search } } },
          { item: { serial: { contains: options.search } } },
          { unit: { arabicName: { contains: options.search } } },
          { unit: { englishName: { contains: options.search } } },
          { unit: { code: { contains: options.search } } },
        ];
      }

      if (options.itemId) {
        where.itemId = options.itemId;
      }

      if (options.unitId) {
        where.unitId = options.unitId;
      }

      if (options.isBaseUnit !== undefined) {
        where.isBaseUnit = options.isBaseUnit;
      }

      const [itemUnits, total] = await Promise.all([
        prisma.itemUnit.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { item: { arabicName: 'asc' } },
            { unit: { arabicName: 'asc' } },
          ],
          include: {
            item: {
              select: {
                id: true,
                serial: true,
                arabicName: true,
              },
            },
            unit: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.itemUnit.count({ where }),
      ]);

      return {
        itemUnits,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing item units');
      throw error;
    }
  }

  /**
   * Update item unit
   */
  async updateItemUnit(
    companyId: string,
    itemUnitId: string,
    data: UpdateItemUnitData
  ) {
    try {
      const existing = await prisma.itemUnit.findFirst({
        where: {
          id: itemUnitId,
          item: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Item unit not found');
      }

      // If this is being set as base unit, unset other base units for this item
      if (data.isBaseUnit && !existing.isBaseUnit) {
        await prisma.itemUnit.updateMany({
          where: {
            itemId: existing.itemId,
            isBaseUnit: true,
            id: { not: itemUnitId },
          },
          data: {
            isBaseUnit: false,
          },
        });
      }

      const itemUnit = await prisma.itemUnit.update({
        where: { id: itemUnitId },
        data: {
          ...(data.conversionFactor !== undefined && {
            conversionFactor: new Decimal(data.conversionFactor),
          }),
          ...(data.isFactorFixed !== undefined && { isFactorFixed: data.isFactorFixed }),
          ...(data.isBaseUnit !== undefined && { isBaseUnit: data.isBaseUnit }),
        },
        include: {
          item: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          unit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      logger.info({ companyId, itemUnitId }, 'Item unit updated');
      return itemUnit;
    } catch (error) {
      logger.error(
        { error, companyId, itemUnitId, data },
        'Error updating item unit'
      );
      throw error;
    }
  }

  /**
   * Delete item unit
   */
  async deleteItemUnit(companyId: string, itemUnitId: string) {
    try {
      const itemUnit = await prisma.itemUnit.findFirst({
        where: {
          id: itemUnitId,
          item: {
            companyId,
          },
        },
      });

      if (!itemUnit) {
        throw new Error('Item unit not found');
      }

      await prisma.itemUnit.delete({
        where: { id: itemUnitId },
      });

      logger.info({ companyId, itemUnitId }, 'Item unit deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, itemUnitId }, 'Error deleting item unit');
      throw error;
    }
  }

  /**
   * Get item unit by item and unit
   */
  async getItemUnitByKeys(companyId: string, itemId: string, unitId: string) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Verify unit belongs to company
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, companyId },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      const itemUnit = await prisma.itemUnit.findFirst({
        where: {
          itemId,
          unitId,
        },
        include: {
          item: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          unit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!itemUnit) {
        throw new Error('Item unit not found');
      }

      return itemUnit;
    } catch (error) {
      logger.error(
        { error, companyId, itemId, unitId },
        'Error getting item unit by keys'
      );
      throw error;
    }
  }
}

export const itemUnitService = new ItemUnitService();
