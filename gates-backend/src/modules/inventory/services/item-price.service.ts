// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface ItemPriceTierFields {
  discount?: number | null;
  purchasePrice?: number | null;
  wholesale?: number | null;
  semiWholesale?: number | null;
  exportPrice?: number | null;
  representativePrice?: number | null;
  retailPrice?: number | null;
  consumerPrice?: number | null;
}

export interface CreateItemPriceData extends ItemPriceTierFields {
  itemId: string;
  priceListId: string;
  unitId: string;
  price: number;
}

export interface UpdateItemPriceData extends ItemPriceTierFields {
  price?: number;
}

function dec(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Decimal(value);
}

function tierWriteData(data: ItemPriceTierFields) {
  return {
    ...(data.discount !== undefined && { discount: dec(data.discount) }),
    ...(data.purchasePrice !== undefined && { purchasePrice: dec(data.purchasePrice) }),
    ...(data.wholesale !== undefined && { wholesale: dec(data.wholesale) }),
    ...(data.semiWholesale !== undefined && { semiWholesale: dec(data.semiWholesale) }),
    ...(data.exportPrice !== undefined && { exportPrice: dec(data.exportPrice) }),
    ...(data.representativePrice !== undefined && { representativePrice: dec(data.representativePrice) }),
    ...(data.retailPrice !== undefined && { retailPrice: dec(data.retailPrice) }),
    ...(data.consumerPrice !== undefined && { consumerPrice: dec(data.consumerPrice) }),
  };
}

export class ItemPriceService {
  /**
   * Create a new item price
   */
  async createItemPrice(companyId: string, data: CreateItemPriceData) {
    try {
      // Verify item belongs to company
      const item = await prisma.item.findFirst({
        where: { id: data.itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      // Verify price list belongs to company
      const priceList = await prisma.priceList.findFirst({
        where: { id: data.priceListId, companyId },
      });

      if (!priceList) {
        throw new Error('Price list not found');
      }

      // Verify unit belongs to company
      const unit = await prisma.unit.findFirst({
        where: { id: data.unitId, companyId },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      const itemPrice = await prisma.itemPrice.create({
        data: {
          itemId: data.itemId,
          priceListId: data.priceListId,
          unitId: data.unitId,
          price: new Decimal(data.price),
          ...tierWriteData(data),
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
          priceList: {
            select: {
              id: true,
              code: true,
              arabicName: true,
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

      logger.info({ companyId, itemPriceId: itemPrice.id }, 'Item price created');
      return itemPrice;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating item price');
      throw error;
    }
  }

  /**
   * Get item price by ID
   */
  async getItemPriceById(companyId: string, itemPriceId: string) {
    try {
      const itemPrice = await prisma.itemPrice.findFirst({
        where: {
          id: itemPriceId,
          item: {
            companyId,
          },
          priceList: {
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
          priceList: {
            select: {
              id: true,
              code: true,
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

      if (!itemPrice) {
        throw new Error('Item price not found');
      }

      return itemPrice;
    } catch (error) {
      logger.error({ error, companyId, itemPriceId }, 'Error getting item price');
      throw error;
    }
  }

  /**
   * List item prices with pagination and filters
   */
  async listItemPrices(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      itemId?: string;
      priceListId?: string;
      unitId?: string;
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
        priceList: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { item: { arabicName: { contains: options.search } } },
          { item: { englishName: { contains: options.search } } },
          { item: { serial: { contains: options.search } } },
          { priceList: { arabicName: { contains: options.search } } },
        ];
      }

      if (options.itemId) {
        where.itemId = options.itemId;
      }

      if (options.priceListId) {
        where.priceListId = options.priceListId;
      }

      if (options.unitId) {
        where.unitId = options.unitId;
      }

      const [itemPrices, total] = await Promise.all([
        prisma.itemPrice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { item: { arabicName: 'asc' } },
            { priceList: { arabicName: 'asc' } },
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
            priceList: {
              select: {
                id: true,
                code: true,
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
        prisma.itemPrice.count({ where }),
      ]);

      return {
        itemPrices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing item prices');
      throw error;
    }
  }

  /**
   * Update item price
   */
  async updateItemPrice(
    companyId: string,
    itemPriceId: string,
    data: UpdateItemPriceData
  ) {
    try {
      const existing = await prisma.itemPrice.findFirst({
        where: {
          id: itemPriceId,
          item: {
            companyId,
          },
          priceList: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Item price not found');
      }

      const itemPrice = await prisma.itemPrice.update({
        where: { id: itemPriceId },
        data: {
          ...(data.price !== undefined && { price: new Decimal(data.price) }),
          ...tierWriteData(data),
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
          priceList: {
            select: {
              id: true,
              code: true,
              arabicName: true,
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

      logger.info({ companyId, itemPriceId }, 'Item price updated');
      return itemPrice;
    } catch (error) {
      logger.error(
        { error, companyId, itemPriceId, data },
        'Error updating item price'
      );
      throw error;
    }
  }

  /**
   * Delete item price
   */
  async deleteItemPrice(companyId: string, itemPriceId: string) {
    try {
      const itemPrice = await prisma.itemPrice.findFirst({
        where: {
          id: itemPriceId,
          item: {
            companyId,
          },
          priceList: {
            companyId,
          },
        },
      });

      if (!itemPrice) {
        throw new Error('Item price not found');
      }

      await prisma.itemPrice.delete({
        where: { id: itemPriceId },
      });

      logger.info({ companyId, itemPriceId }, 'Item price deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, itemPriceId }, 'Error deleting item price');
      throw error;
    }
  }

  /**
   * Get item price by item, price list, and unit
   */
  async getItemPriceByKeys(
    companyId: string,
    itemId: string,
    priceListId: string,
    unitId: string
  ) {
    try {
      // Verify all entities belong to company
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const priceList = await prisma.priceList.findFirst({
        where: { id: priceListId, companyId },
      });

      if (!priceList) {
        throw new Error('Price list not found');
      }

      const unit = await prisma.unit.findFirst({
        where: { id: unitId, companyId },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      const itemPrice = await prisma.itemPrice.findFirst({
        where: {
          itemId,
          priceListId,
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
          priceList: {
            select: {
              id: true,
              code: true,
              arabicName: true,
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

      if (!itemPrice) {
        throw new Error('Item price not found');
      }

      return itemPrice;
    } catch (error) {
      logger.error(
        { error, companyId, itemId, priceListId, unitId },
        'Error getting item price by keys'
      );
      throw error;
    }
  }
}

export const itemPriceService = new ItemPriceService();
