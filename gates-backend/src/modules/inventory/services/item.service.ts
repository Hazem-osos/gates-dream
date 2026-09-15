import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { advancedFlag, nextNumericCode } from '../../../shared/utils/next-numeric-code';

function decimalOp(
  op?: 'none' | 'eq' | 'gt' | 'lt' | 'between',
  from?: number,
  to?: number
) {
  if (!op || op === 'none') return undefined;
  const a = from != null && Number.isFinite(from) ? from : undefined;
  const b = to != null && Number.isFinite(to) ? to : undefined;
  if (op === 'eq' && a != null) return { equals: new Decimal(a) };
  if (op === 'gt' && a != null) return { gt: new Decimal(a) };
  if (op === 'lt' && (b != null || a != null)) return { lt: new Decimal(b ?? a ?? 0) };
  if (op === 'between' && (a != null || b != null)) {
    return {
      ...(a != null ? { gte: new Decimal(a) } : {}),
      ...(b != null ? { lte: new Decimal(b) } : {}),
    };
  }
  return undefined;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return value as Prisma.InputJsonValue;
}

function itemCardExtraFields(data: CreateItemData) {
  return {
    priceMode: data.priceMode ?? null,
    priceCurrency: data.priceCurrency ?? null,
    extraAssemblyCost:
      data.extraAssemblyCost != null ? new Decimal(data.extraAssemblyCost) : null,
    extraAssemblyCostPct:
      data.extraAssemblyCostPct != null ? new Decimal(data.extraAssemblyCostPct) : null,
    purchaseCount: data.purchaseCount ?? null,
    minPurchaseQty: data.minPurchaseQty != null ? new Decimal(data.minPurchaseQty) : null,
    ...(data.assemblyComponents !== undefined
      ? { assemblyComponents: asJson(data.assemblyComponents) ?? Prisma.JsonNull }
      : {}),
    ...(data.preferredSuppliers !== undefined
      ? { preferredSuppliers: asJson(data.preferredSuppliers) ?? Prisma.JsonNull }
      : {}),
    imageUrl: data.imageUrl ?? null,
    defaultWarehouseId: data.defaultWarehouseId ?? null,
    priceSource: data.priceSource ?? null,
    ...(data.lastPurchasePrice != null
      ? { lastPurchasePrice: new Decimal(data.lastPurchasePrice) }
      : {}),
  };
}

export interface CreateItemData {
  serial?: string;
  arabicName: string;
  englishName?: string;
  mainAccountId?: string;
  costCenterId?: string;
  categoryId?: string | null;
  barcode?: string | null;
  salesAccountId?: string | null;
  cogsAccountId?: string | null;
  defaultTaxPercent?: number | null;
  taxExemptionReason?: string | null;
  specifications?: string;
  itemType?: string;
  weight?: number;
  manufacturerId?: string;
  colorId?: string;
  countryOfOrigin?: string;
  quality?: string;
  size?: string;
  property1?: string;
  property2?: string;
  property3?: string;
  property4?: string;
  property5?: string;
  useExpirationDate?: boolean;
  inactiveItem?: boolean;
  notSubjectToTerms?: boolean;
  cannotBeReturned?: boolean;
  noSellBelowCost?: boolean;
  useSerialNumber?: boolean;
  clothingItem?: boolean;
  upperLimit?: number;
  orderLimit?: number;
  orderLimitPercentage?: number;
  lowerLimit?: number;
  beginningBalance?: number;
  beginningCostPrice?: number;
  priceRetail?: number;
  priceSemiWholesale?: number;
  priceWholesale?: number;
  priceProjects?: number;
  isService?: boolean;
  isAssembly?: boolean;
  isTaxExempt?: boolean;
  consumerPrice?: number;
  retailPrice?: number;
  representativePrice?: number;
  exportPrice?: number;
  priceMode?: string | null;
  priceCurrency?: string | null;
  extraAssemblyCost?: number | null;
  extraAssemblyCostPct?: number | null;
  purchaseCount?: number | null;
  minPurchaseQty?: number | null;
  assemblyComponents?: unknown;
  preferredSuppliers?: unknown;
  imageUrl?: string | null;
  defaultWarehouseId?: string | null;
  priceSource?: string | null;
  lastPurchasePrice?: number | null;
}

function resolveItemPriceTiers(data: Pick<
  CreateItemData,
  'priceRetail' | 'retailPrice' | 'consumerPrice' | 'representativePrice' | 'exportPrice'
>) {
  const priceRetail = data.priceRetail ?? data.retailPrice ?? 0;
  const retailPrice = data.retailPrice ?? data.priceRetail ?? 0;
  return {
    priceRetail: new Decimal(priceRetail),
    retailPrice: new Decimal(retailPrice),
    consumerPrice: new Decimal(data.consumerPrice ?? 0),
    representativePrice: new Decimal(data.representativePrice ?? 0),
    exportPrice: new Decimal(data.exportPrice ?? 0),
  };
}

export interface UpdateItemData extends Partial<CreateItemData> {
  isActive?: boolean;
}

export class ItemService {
  /**
   * Create a new item
   */
  private async isItemAutoNumbering(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { advancedSettings: true },
    });
    return advancedFlag(settings?.advancedSettings, 'itemAutoNumbering');
  }

  private async suggestNextItemSerial(companyId: string): Promise<string> {
    const rows = await prisma.item.findMany({
      where: { companyId, isActive: true },
      select: { serial: true },
    });
    return nextNumericCode(rows.map((row) => row.serial));
  }

  async createItem(companyId: string, data: CreateItemData) {
    try {
      const auto = await this.isItemAutoNumbering(companyId);
      let serial = data.serial?.trim() ?? '';
      if (auto) {
        serial = await this.suggestNextItemSerial(companyId);
      } else if (!serial) {
        throw new AppError(400, 'رقم الصنف مطلوب — الترقيم يدوي.');
      }
      // Sales Invoice Enterprise Redesign: "auto-assign GL accounts by
      // category" — when a category is selected, snapshot its defaults onto
      // any of mainAccountId/salesAccountId/cogsAccountId the caller left
      // blank at create time. Explicit per-item values always win. This is a
      // one-time assignment (not a live join at posting time), so changing
      // a category's defaults later never silently reclassifies existing items.
      let mainAccountId = data.mainAccountId ?? null;
      let salesAccountId = data.salesAccountId ?? null;
      let cogsAccountId = data.cogsAccountId ?? null;

      if (data.categoryId) {
        const category = await prisma.itemCategory.findFirst({
          where: { id: data.categoryId, companyId },
        });
        if (!category) {
          throw new AppError(400, 'Item category not found');
        }
        mainAccountId = mainAccountId ?? category.defaultInventoryAccountId ?? null;
        salesAccountId = salesAccountId ?? category.defaultSalesAccountId ?? null;
        cogsAccountId = cogsAccountId ?? category.defaultCogsAccountId ?? null;
      }

      const priceTiers = resolveItemPriceTiers(data);

      const item = await prisma.item.create({
        data: {
          companyId,
          serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          mainAccountId,
          costCenterId: data.costCenterId,
          categoryId: data.categoryId ?? null,
          barcode: data.barcode ?? null,
          salesAccountId,
          cogsAccountId,
          defaultTaxPercent:
            data.defaultTaxPercent != null ? new Decimal(data.defaultTaxPercent) : null,
          taxExemptionReason: data.taxExemptionReason ?? null,
          specifications: data.specifications,
          itemType: data.itemType,
          weight: data.weight ? new Decimal(data.weight) : null,
          manufacturerId: data.manufacturerId,
          colorId: data.colorId,
          countryOfOrigin: data.countryOfOrigin,
          quality: data.quality,
          size: data.size,
          property1: data.property1,
          property2: data.property2,
          property3: data.property3,
          property4: data.property4,
          property5: data.property5,
          useExpirationDate: data.useExpirationDate || false,
          inactiveItem: data.inactiveItem || false,
          notSubjectToTerms: data.notSubjectToTerms || false,
          cannotBeReturned: data.cannotBeReturned || false,
          noSellBelowCost: data.noSellBelowCost || false,
          useSerialNumber: data.useSerialNumber || false,
          clothingItem: data.clothingItem || false,
          upperLimit: data.upperLimit ? new Decimal(data.upperLimit) : null,
          orderLimit: data.orderLimit ? new Decimal(data.orderLimit) : null,
          orderLimitPercentage: data.orderLimitPercentage
            ? new Decimal(data.orderLimitPercentage)
            : null,
          lowerLimit: data.lowerLimit ? new Decimal(data.lowerLimit) : null,
          beginningBalance: data.beginningBalance
            ? new Decimal(data.beginningBalance)
            : null,
          beginningCostPrice: data.beginningCostPrice
            ? new Decimal(data.beginningCostPrice)
            : null,
          priceRetail: priceTiers.priceRetail,
          priceSemiWholesale: new Decimal(data.priceSemiWholesale ?? 0),
          priceWholesale: new Decimal(data.priceWholesale ?? 0),
          priceProjects: new Decimal(data.priceProjects ?? 0),
          isService: data.isService ?? false,
          isAssembly: data.isAssembly ?? false,
          isTaxExempt: data.isTaxExempt ?? false,
          consumerPrice: priceTiers.consumerPrice,
          retailPrice: priceTiers.retailPrice,
          representativePrice: priceTiers.representativePrice,
          exportPrice: priceTiers.exportPrice,
          ...itemCardExtraFields(data),
        },
        include: {
          category: {
            select: { id: true, code: true, arabicName: true, englishName: true },
          },
          units: {
            include: {
              unit: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
          prices: {
            include: {
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
          },
        },
      });

      logger.info({ companyId, itemId: item.id }, 'Item created');
      return item;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating item');
      throw error;
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(companyId: string, itemId: string) {
    try {
      const item = await prisma.item.findFirst({
        where: {
          id: itemId,
          companyId,
        },
        include: {
          category: {
            select: { id: true, code: true, arabicName: true, englishName: true },
          },
          units: {
            include: {
              unit: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
          prices: {
            include: {
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
          },
          quantities: {
            include: {
              warehouse: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
              location: {
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

      if (!item) {
        throw new Error('Item not found');
      }

      return item;
    } catch (error) {
      logger.error({ error, companyId, itemId }, 'Error getting item');
      throw error;
    }
  }

  /**
   * List items with pagination and filters
   */
  async listItems(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      itemType?: string;
      isActive?: boolean;
      categoryId?: string;
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
        const prefix = options.search.trim();
        const ftIds = await findFullTextIds('items', companyId, options.search);
        const scoped = applyFullTextIds(where, ftIds);
        if (scoped === 'empty') {
          where.OR = [
            { englishName: { startsWith: prefix } },
            { serial: { startsWith: prefix } },
            { barcode: { startsWith: prefix } },
          ];
        } else if (ftIds?.length) {
          where.OR = [
            { id: { in: ftIds } },
            { englishName: { startsWith: prefix } },
          ];
          delete where.id;
        }
      }

      if (options.itemType) {
        where.itemType = options.itemType;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.categoryId) {
        where.categoryId = options.categoryId;
      }

      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            category: {
              select: { id: true, code: true, arabicName: true, englishName: true },
            },
            units: {
              include: {
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
        }),
        prisma.item.count({ where }),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing items');
      throw error;
    }
  }

  async findItemByBarcode(companyId: string, barcode: string) {
    const code = barcode.trim();
    if (!code) {
      throw new AppError(400, 'barcode required');
    }

    const item = await prisma.item.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [{ barcode: code }, { serial: code }],
      },
      include: {
        category: {
          select: { id: true, code: true, arabicName: true, englishName: true },
        },
        units: {
          include: {
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

    if (!item) {
      throw new AppError(404, 'الباركود غير مسجل');
    }

    return item;
  }

  /**
   * Update item
   */
  async updateItem(
    companyId: string,
    itemId: string,
    data: UpdateItemData
  ) {
    try {
      const existing = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!existing) {
        throw new Error('Item not found');
      }

      const updateData: any = {};

      if (data.serial !== undefined) updateData.serial = data.serial || null;
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined)
        updateData.englishName = data.englishName;
      if (data.manufacturerId !== undefined) updateData.manufacturerId = data.manufacturerId || null;
      if (data.colorId !== undefined) updateData.colorId = data.colorId || null;
      if (data.countryOfOrigin !== undefined) updateData.countryOfOrigin = data.countryOfOrigin || null;
      if (data.quality !== undefined) updateData.quality = data.quality || null;
      if (data.size !== undefined) updateData.size = data.size || null;
      if (data.property1 !== undefined) updateData.property1 = data.property1 || null;
      if (data.property2 !== undefined) updateData.property2 = data.property2 || null;
      if (data.property3 !== undefined) updateData.property3 = data.property3 || null;
      if (data.property4 !== undefined) updateData.property4 = data.property4 || null;
      if (data.property5 !== undefined) updateData.property5 = data.property5 || null;
      if (data.priceMode !== undefined) updateData.priceMode = data.priceMode;
      if (data.priceCurrency !== undefined) updateData.priceCurrency = data.priceCurrency;
      if (data.extraAssemblyCost !== undefined) {
        updateData.extraAssemblyCost =
          data.extraAssemblyCost != null ? new Decimal(data.extraAssemblyCost) : null;
      }
      if (data.extraAssemblyCostPct !== undefined) {
        updateData.extraAssemblyCostPct =
          data.extraAssemblyCostPct != null ? new Decimal(data.extraAssemblyCostPct) : null;
      }
      if (data.purchaseCount !== undefined) updateData.purchaseCount = data.purchaseCount;
      if (data.minPurchaseQty !== undefined) {
        updateData.minPurchaseQty =
          data.minPurchaseQty != null ? new Decimal(data.minPurchaseQty) : null;
      }
      if (data.assemblyComponents !== undefined) {
        updateData.assemblyComponents = asJson(data.assemblyComponents) ?? Prisma.JsonNull;
      }
      if (data.preferredSuppliers !== undefined) {
        updateData.preferredSuppliers = asJson(data.preferredSuppliers) ?? Prisma.JsonNull;
      }
      if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
      if (data.defaultWarehouseId !== undefined) {
        updateData.defaultWarehouseId = data.defaultWarehouseId || null;
      }
      if (data.priceSource !== undefined) updateData.priceSource = data.priceSource || null;
      if (data.lastPurchasePrice !== undefined) {
        updateData.lastPurchasePrice =
          data.lastPurchasePrice != null ? new Decimal(data.lastPurchasePrice) : new Decimal(0);
      }
      if (data.mainAccountId !== undefined) updateData.mainAccountId = data.mainAccountId;
      if (data.costCenterId !== undefined) updateData.costCenterId = data.costCenterId;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.barcode !== undefined) updateData.barcode = data.barcode;
      if (data.salesAccountId !== undefined) updateData.salesAccountId = data.salesAccountId;
      if (data.cogsAccountId !== undefined) updateData.cogsAccountId = data.cogsAccountId;
      if (data.defaultTaxPercent !== undefined) {
        updateData.defaultTaxPercent =
          data.defaultTaxPercent != null ? new Decimal(data.defaultTaxPercent) : null;
      }
      if (data.taxExemptionReason !== undefined) {
        updateData.taxExemptionReason = data.taxExemptionReason;
      }
      if (data.specifications !== undefined)
        updateData.specifications = data.specifications;
      if (data.itemType !== undefined) updateData.itemType = data.itemType;
      if (data.weight !== undefined)
        updateData.weight = data.weight ? new Decimal(data.weight) : null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.priceRetail !== undefined || data.retailPrice !== undefined) {
        const priceRetail = data.priceRetail ?? data.retailPrice ?? 0;
        const retailPrice = data.retailPrice ?? data.priceRetail ?? 0;
        updateData.priceRetail = new Decimal(priceRetail);
        updateData.retailPrice = new Decimal(retailPrice);
      }
      if (data.priceSemiWholesale !== undefined) {
        updateData.priceSemiWholesale = new Decimal(data.priceSemiWholesale);
      }
      if (data.priceWholesale !== undefined) updateData.priceWholesale = new Decimal(data.priceWholesale);
      if (data.priceProjects !== undefined) updateData.priceProjects = new Decimal(data.priceProjects);
      if (data.isService !== undefined) updateData.isService = data.isService;
      if (data.isAssembly !== undefined) updateData.isAssembly = data.isAssembly;
      if (data.isTaxExempt !== undefined) updateData.isTaxExempt = data.isTaxExempt;
      if (data.consumerPrice !== undefined) updateData.consumerPrice = new Decimal(data.consumerPrice);
      if (data.representativePrice !== undefined) {
        updateData.representativePrice = new Decimal(data.representativePrice);
      }
      if (data.exportPrice !== undefined) updateData.exportPrice = new Decimal(data.exportPrice);
      if (data.useExpirationDate !== undefined) updateData.useExpirationDate = data.useExpirationDate;
      if (data.inactiveItem !== undefined) updateData.inactiveItem = data.inactiveItem;
      if (data.notSubjectToTerms !== undefined) updateData.notSubjectToTerms = data.notSubjectToTerms;
      if (data.cannotBeReturned !== undefined) updateData.cannotBeReturned = data.cannotBeReturned;
      if (data.noSellBelowCost !== undefined) updateData.noSellBelowCost = data.noSellBelowCost;
      if (data.useSerialNumber !== undefined) updateData.useSerialNumber = data.useSerialNumber;
      if (data.clothingItem !== undefined) updateData.clothingItem = data.clothingItem;
      if (data.upperLimit !== undefined) {
        updateData.upperLimit = data.upperLimit != null ? new Decimal(data.upperLimit) : null;
      }
      if (data.orderLimit !== undefined) {
        updateData.orderLimit = data.orderLimit != null ? new Decimal(data.orderLimit) : null;
      }
      if (data.orderLimitPercentage !== undefined) {
        updateData.orderLimitPercentage =
          data.orderLimitPercentage != null ? new Decimal(data.orderLimitPercentage) : null;
      }
      if (data.lowerLimit !== undefined) {
        updateData.lowerLimit = data.lowerLimit != null ? new Decimal(data.lowerLimit) : null;
      }
      if (data.beginningBalance !== undefined) {
        updateData.beginningBalance =
          data.beginningBalance != null ? new Decimal(data.beginningBalance) : null;
      }
      if (data.beginningCostPrice !== undefined) {
        updateData.beginningCostPrice =
          data.beginningCostPrice != null ? new Decimal(data.beginningCostPrice) : null;
      }

      const item = await prisma.item.update({
        where: { id: itemId },
        data: updateData,
        include: {
          units: {
            include: {
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

      logger.info({ companyId, itemId }, 'Item updated');
      return item;
    } catch (error) {
      logger.error({ error, companyId, itemId, data }, 'Error updating item');
      throw error;
    }
  }

  /**
   * Find items by barcode / name / price range and return warehouse quantities.
   */
  async searchItemFinder(
    companyId: string,
    options: {
      barcode?: string;
      name?: string;
      purchaseOp?: 'none' | 'eq' | 'gt' | 'lt' | 'between';
      purchaseFrom?: number;
      purchaseTo?: number;
      saleOp?: 'none' | 'eq' | 'gt' | 'lt' | 'between';
      saleFrom?: number;
      saleTo?: number;
      limit?: number;
    }
  ) {
    const limit = Math.min(options.limit || 50, 100);
    const where: any = { companyId, isActive: true };

    const barcode = options.barcode?.trim();
    const name = options.name?.trim();
    if (barcode) {
      where.OR = [
        { barcode: { contains: barcode } },
        { serial: { contains: barcode } },
        { code: { contains: barcode } },
      ];
    }
    if (name) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { arabicName: { contains: name } },
            { englishName: { contains: name } },
          ],
        },
      ];
    }

    const purchaseFilter = decimalOp(options.purchaseOp, options.purchaseFrom, options.purchaseTo);
    if (purchaseFilter) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [{ lastPurchasePrice: purchaseFilter }, { averageCost: purchaseFilter }],
        },
      ];
    }
    const saleFilter = decimalOp(options.saleOp, options.saleFrom, options.saleTo);
    if (saleFilter) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { priceRetail: saleFilter },
            { consumerPrice: saleFilter },
            { priceWholesale: saleFilter },
          ],
        },
      ];
    }

    const items = await prisma.item.findMany({
      where,
      take: limit,
      orderBy: { arabicName: 'asc' },
      select: {
        id: true,
        serial: true,
        barcode: true,
        arabicName: true,
        lastPurchasePrice: true,
        averageCost: true,
        priceRetail: true,
        consumerPrice: true,
        priceWholesale: true,
        quantities: {
          select: {
            quantity: true,
            warehouse: { select: { id: true, code: true, arabicName: true } },
          },
        },
        warehouseBalances: {
          select: {
            quantityOnHand: true,
            warehouse: { select: { id: true, code: true, arabicName: true } },
          },
        },
      },
    });

    const rows = items.flatMap((item) => {
      const byWarehouse = new Map<
        string,
        { warehouseId: string; warehouseName: string; quantity: number }
      >();
      for (const q of item.quantities) {
        const id = q.warehouse.id;
        const qty = Number(q.quantity) || 0;
        const prev = byWarehouse.get(id);
        byWarehouse.set(id, {
          warehouseId: id,
          warehouseName: q.warehouse.arabicName,
          quantity: (prev?.quantity ?? 0) + qty,
        });
      }
      if (!byWarehouse.size) {
        for (const bal of item.warehouseBalances) {
          byWarehouse.set(bal.warehouse.id, {
            warehouseId: bal.warehouse.id,
            warehouseName: bal.warehouse.arabicName,
            quantity: Number(bal.quantityOnHand) || 0,
          });
        }
      }
      const stock = [...byWarehouse.values()];
      const base = {
        itemId: item.id,
        itemName: item.arabicName,
        itemCode: item.serial || '',
        barcode: item.barcode || '',
        purchasePrice: Number(item.lastPurchasePrice || item.averageCost || 0),
        salePrice: Number(item.priceRetail || item.consumerPrice || item.priceWholesale || 0),
      };
      if (!stock.length) {
        return [{ ...base, warehouseId: '', warehouseName: '—', quantity: 0 }];
      }
      return stock.map((row) => ({ ...base, ...row }));
    });

    return { rows, items: items.length };
  }

  /**
   * Delete item (soft delete)
   */
  async deleteItem(companyId: string, itemId: string) {
    try {
      const item = await prisma.item.findFirst({
        where: { id: itemId, companyId },
      });

      if (!item) {
        throw new Error('Item not found');
      }

      await prisma.item.update({
        where: { id: itemId },
        data: { isActive: false },
      });

      logger.info({ companyId, itemId }, 'Item deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, itemId }, 'Error deleting item');
      throw error;
    }
  }
}

export const itemService = new ItemService();
