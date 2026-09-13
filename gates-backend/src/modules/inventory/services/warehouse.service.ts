// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateWarehouseData {
  code?: string;
  arabicName: string;
  englishName?: string;
  branchId?: string | null;
  storeType?: string | null;
  parentWarehouseId?: string | null;
  inventoryAccountId?: string | null;
  costAccountId?: string | null;
  giftAccountId?: string | null;
  address?: string | null;
  keeperName?: string | null;
}

export interface UpdateWarehouseData extends Partial<CreateWarehouseData> {
  isActive?: boolean;
}

const branchSummarySelect = {
  id: true,
  arabicName: true,
  legacyBranchCode: true,
} as const;

async function assertWarehouseRefs(
  companyId: string,
  data: CreateWarehouseData,
  selfId?: string
) {
  const accountIds = [data.inventoryAccountId, data.costAccountId, data.giftAccountId].filter(
    (id): id is string => Boolean(id)
  );
  if (accountIds.length) {
    const found = await prisma.account.count({
      where: { companyId, id: { in: accountIds } },
    });
    if (found !== accountIds.length) {
      throw new Error('حساب المخزن غير موجود في دليل الحسابات');
    }
  }
  if (data.parentWarehouseId) {
    if (selfId && data.parentWarehouseId === selfId) {
      throw new Error('لا يمكن أن يكون المخزن رئيسيًا لنفسه');
    }
    const parent = await prisma.warehouse.findFirst({
      where: { id: data.parentWarehouseId, companyId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error('المخزن الرئيسي غير موجود');
    }
  }
}

function warehouseCardFields(data: CreateWarehouseData) {
  return {
    storeType: data.storeType ?? null,
    parentWarehouseId: data.parentWarehouseId || null,
    inventoryAccountId: data.inventoryAccountId || null,
    costAccountId: data.costAccountId || null,
    giftAccountId: data.giftAccountId || null,
    address: data.address?.trim() || null,
    keeperName: data.keeperName?.trim() || null,
  };
}

export class WarehouseService {
  /**
   * Create a new warehouse
   */
  async createWarehouse(companyId: string, data: CreateWarehouseData) {
    try {
      await assertWarehouseRefs(companyId, data);
      const warehouse = await prisma.warehouse.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          ...(data.branchId ? { branchId: data.branchId } : {}),
          ...warehouseCardFields(data),
        },
        include: {
          branch: {
            select: branchSummarySelect,
          },
          locations: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, warehouseId: warehouse.id }, 'Warehouse created');
      return warehouse;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating warehouse');
      throw error;
    }
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(companyId: string, warehouseId: string) {
    try {
      const warehouse = await prisma.warehouse.findFirst({
        where: {
          id: warehouseId,
          companyId,
        },
        include: {
          branch: {
            select: branchSummarySelect,
          },
          locations: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      return warehouse;
    } catch (error) {
      logger.error({ error, companyId, warehouseId }, 'Error getting warehouse');
      throw error;
    }
  }

  /**
   * List warehouses
   */
  async listWarehouses(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      branchId?: string;
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

      if (options.branchId) {
        where.branchId = options.branchId;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [warehouses, total] = await Promise.all([
        prisma.warehouse.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            branch: {
              select: {
                id: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.warehouse.count({ where }),
      ]);

      return {
        warehouses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing warehouses');
      throw error;
    }
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(
    companyId: string,
    warehouseId: string,
    data: UpdateWarehouseData
  ) {
    try {
      const existing = await prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });

      if (!existing) {
        throw new Error('Warehouse not found');
      }

      await assertWarehouseRefs(companyId, data, warehouseId);

      const warehouse = await prisma.warehouse.update({
        where: { id: warehouseId },
        data: {
          ...(data.code && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.branchId !== undefined && { branchId: data.branchId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.storeType !== undefined && { storeType: data.storeType }),
          ...(data.parentWarehouseId !== undefined && { parentWarehouseId: data.parentWarehouseId || null }),
          ...(data.inventoryAccountId !== undefined && { inventoryAccountId: data.inventoryAccountId || null }),
          ...(data.costAccountId !== undefined && { costAccountId: data.costAccountId || null }),
          ...(data.giftAccountId !== undefined && { giftAccountId: data.giftAccountId || null }),
          ...(data.address !== undefined && { address: data.address?.trim() || null }),
          ...(data.keeperName !== undefined && { keeperName: data.keeperName?.trim() || null }),
        },
        include: {
          branch: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, warehouseId }, 'Warehouse updated');
      return warehouse;
    } catch (error) {
      logger.error({ error, companyId, warehouseId, data }, 'Error updating warehouse');
      throw error;
    }
  }

  /**
   * Delete warehouse (soft delete)
   */
  async deleteWarehouse(companyId: string, warehouseId: string) {
    try {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      await prisma.warehouse.update({
        where: { id: warehouseId },
        data: { isActive: false },
      });

      logger.info({ companyId, warehouseId }, 'Warehouse deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, warehouseId }, 'Error deleting warehouse');
      throw error;
    }
  }
}

export const warehouseService = new WarehouseService();
