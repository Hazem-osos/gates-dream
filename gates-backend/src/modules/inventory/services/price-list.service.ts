// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreatePriceListData {
  code?: string;
  arabicName: string;
  englishName?: string;
  description?: string | null;
  discountPercentage?: number | null;
  currencyCode?: string | null;
  priceMode?: string | null;
}

export interface UpdatePriceListData extends Partial<CreatePriceListData> {
  isActive?: boolean;
}

export interface PriceListPriceRowInput {
  id?: string;
  itemId: string;
  unitId: string;
  price?: number;
  discount?: number | null;
  purchasePrice?: number | null;
  wholesale?: number | null;
  semiWholesale?: number | null;
  exportPrice?: number | null;
  representativePrice?: number | null;
  retailPrice?: number | null;
  consumerPrice?: number | null;
}

function dec(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Decimal(value);
}

export class PriceListService {
  /**
   * Create a new price list
   */
  async createPriceList(companyId: string, data: CreatePriceListData) {
    try {
      const priceList = await prisma.priceList.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          description: data.description,
          discountPercentage: data.discountPercentage,
          currencyCode: data.currencyCode,
          priceMode: data.priceMode,
        },
        include: {
          prices: {
            take: 10, // Limit prices for initial response
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
          },
        },
      });

      logger.info({ companyId, priceListId: priceList.id }, 'Price list created');
      return priceList;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating price list');
      throw error;
    }
  }

  /**
   * Get price list by ID
   */
  async getPriceListById(companyId: string, priceListId: string) {
    try {
      const priceList = await prisma.priceList.findFirst({
        where: {
          id: priceListId,
          companyId,
        },
        include: {
          prices: {
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                  categoryId: true,
                  lastPurchasePrice: true,
                  priceRetail: true,
                  priceWholesale: true,
                  priceSemiWholesale: true,
                  exportPrice: true,
                  representativePrice: true,
                  priceRetail: true,
                  consumerPrice: true,
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
            orderBy: [
              { item: { arabicName: 'asc' } },
              { unit: { arabicName: 'asc' } },
            ],
          },
        },
      });

      if (!priceList) {
        throw new Error('Price list not found');
      }

      return priceList;
    } catch (error) {
      logger.error({ error, companyId, priceListId }, 'Error getting price list');
      throw error;
    }
  }

  /**
   * List price lists with pagination and filters
   */
  async listPriceLists(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
      };

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [priceLists, total] = await Promise.all([
        prisma.priceList.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            prices: {
              take: 5, // Limit prices for listing
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.priceList.count({ where }),
      ]);

      return {
        priceLists,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing price lists');
      throw error;
    }
  }

  /**
   * Update price list
   */
  async updatePriceList(
    companyId: string,
    priceListId: string,
    data: UpdatePriceListData
  ) {
    try {
      const existing = await prisma.priceList.findFirst({
        where: { id: priceListId, companyId },
      });

      if (!existing) {
        throw new Error('Price list not found');
      }

      const priceList = await prisma.priceList.update({
        where: { id: priceListId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountPercentage !== undefined && { discountPercentage: data.discountPercentage }),
          ...(data.currencyCode !== undefined && { currencyCode: data.currencyCode }),
          ...(data.priceMode !== undefined && { priceMode: data.priceMode }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          prices: {
            take: 10,
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
          },
        },
      });

      logger.info({ companyId, priceListId }, 'Price list updated');
      return priceList;
    } catch (error) {
      logger.error(
        { error, companyId, priceListId, data },
        'Error updating price list'
      );
      throw error;
    }
  }

  /**
   * Bulk upsert item prices for a list. `replace` removes rows no longer sent.
   */
  async upsertPrices(
    companyId: string,
    priceListId: string,
    prices: PriceListPriceRowInput[],
    replace = false
  ) {
    const existingList = await prisma.priceList.findFirst({
      where: { id: priceListId, companyId },
    });
    if (!existingList) {
      throw new Error('Price list not found');
    }

    const itemIds = [...new Set(prices.map((p) => p.itemId))];
    const unitIds = [...new Set(prices.map((p) => p.unitId))];
    if (itemIds.length) {
      const [items, units] = await Promise.all([
        prisma.item.findMany({
          where: { companyId, id: { in: itemIds } },
          select: { id: true },
        }),
        prisma.unit.findMany({
          where: { companyId, id: { in: unitIds } },
          select: { id: true },
        }),
      ]);
      const itemSet = new Set(items.map((i) => i.id));
      const unitSet = new Set(units.map((u) => u.id));
      for (const row of prices) {
        if (!itemSet.has(row.itemId)) throw new Error('Item not found');
        if (!unitSet.has(row.unitId)) throw new Error('Unit not found');
      }
    }

    await prisma.$transaction(async (tx) => {
      if (replace) {
        const incomingKeys = new Set(prices.map((p) => `${p.itemId}:${p.unitId}`));
        const current = await tx.itemPrice.findMany({
          where: { priceListId },
          select: { id: true, itemId: true, unitId: true },
        });
        const staleIds = current
          .filter((row) => !incomingKeys.has(`${row.itemId}:${row.unitId}`))
          .map((row) => row.id);
        if (staleIds.length) {
          await tx.itemPrice.deleteMany({ where: { id: { in: staleIds } } });
        }
      }

      for (const row of prices) {
        const sale = row.price ?? row.retailPrice ?? 0;
        const data = {
          price: new Decimal(sale),
          discount: dec(row.discount) ?? null,
          purchasePrice: dec(row.purchasePrice) ?? null,
          wholesale: dec(row.wholesale) ?? null,
          semiWholesale: dec(row.semiWholesale) ?? null,
          exportPrice: dec(row.exportPrice) ?? null,
          representativePrice: dec(row.representativePrice) ?? null,
          retailPrice: dec(row.retailPrice) ?? (row.price != null ? new Decimal(row.price) : null),
          consumerPrice: dec(row.consumerPrice) ?? null,
        };
        await tx.itemPrice.upsert({
          where: {
            itemId_priceListId_unitId: {
              itemId: row.itemId,
              priceListId,
              unitId: row.unitId,
            },
          },
          create: {
            itemId: row.itemId,
            priceListId,
            unitId: row.unitId,
            ...data,
          },
          update: data,
        });
      }
    });

    logger.info({ companyId, priceListId, count: prices.length }, 'Price list prices upserted');
    return this.getPriceListById(companyId, priceListId);
  }

  /**
   * Permanent delete — prices go with the list.
   */
  async deletePriceList(companyId: string, priceListId: string) {
    const priceList = await prisma.priceList.findFirst({
      where: { id: priceListId, companyId },
      select: { id: true },
    });

    if (!priceList) {
      throw new Error('Price list not found');
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.itemPrice.deleteMany({ where: { priceListId } });
        await tx.customer.updateMany({
          where: { companyId, priceListId },
          data: { priceListId: null },
        });
        await tx.delegate.updateMany({
          where: { companyId, priceListId },
          data: { priceListId: null },
        });
        await tx.newModule.updateMany({
          where: { priceListId },
          data: { priceListId: null },
        });
        await tx.person.updateMany({
          where: { companyId, priceListId },
          data: { priceListId: null },
        });
        await tx.priceList.delete({ where: { id: priceListId } });
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'P2003' || code === 'P2014') {
        throw new Error('لا يمكن حذف قائمة الأسعار لأنها مرتبطة ببيانات أخرى.');
      }
      logger.error({ error, companyId, priceListId }, 'Error deleting price list');
      throw error;
    }

    logger.info({ companyId, priceListId }, 'Price list permanently deleted');
    return { success: true };
  }
}

export const priceListService = new PriceListService();
