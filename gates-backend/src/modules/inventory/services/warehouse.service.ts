// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { nextNumericCode } from '../../../shared/utils/next-numeric-code';

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

function normalizeWarehouseHierarchy(data: CreateWarehouseData) {
  const parentWarehouseId = data.parentWarehouseId || null;
  if (data.storeType === 'SUB' && !parentWarehouseId) {
    throw new AppError(400, 'المخزن الفرعي لازم يكون تحت مخزن رئيسي.');
  }
  if (!parentWarehouseId || data.storeType === 'MAIN') {
    return { storeType: 'MAIN', parentWarehouseId: null as string | null };
  }
  return { storeType: 'SUB', parentWarehouseId };
}

async function assertWarehouseParentCycle(
  companyId: string,
  selfId: string | undefined,
  parentWarehouseId: string | null
) {
  if (!parentWarehouseId) return;
  if (selfId && parentWarehouseId === selfId) {
    throw new AppError(400, 'لا يمكن أن يكون المخزن رئيسيًا لنفسه');
  }

  let current: string | null = parentWarehouseId;
  const seen = new Set<string>(selfId ? [selfId] : []);
  while (current) {
    if (seen.has(current)) {
      throw new AppError(400, 'لا يمكن جعل المخزن فرعاً تحت أحد أبنائه. هذا يكسر شجرة المخازن.');
    }
    seen.add(current);
    const row = await prisma.warehouse.findFirst({
      where: { id: current, companyId },
      select: { parentWarehouseId: true },
    });
    current = row?.parentWarehouseId ?? null;
  }
}

async function assertWarehouseRefs(
  companyId: string,
  data: CreateWarehouseData,
  selfId?: string
) {
  const touchingHierarchy =
    data.storeType !== undefined || data.parentWarehouseId !== undefined;
  if (touchingHierarchy) {
    const hierarchy = normalizeWarehouseHierarchy(data);
    data.storeType = hierarchy.storeType;
    data.parentWarehouseId = hierarchy.parentWarehouseId;
  }

  const accountIds = [data.inventoryAccountId, data.costAccountId, data.giftAccountId].filter(
    (id): id is string => Boolean(id)
  );
  if (accountIds.length) {
    const accounts = await prisma.account.findMany({
      where: { companyId, id: { in: accountIds }, deletedAt: null },
      select: {
        id: true,
        code: true,
        arabicName: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
    if (accounts.length !== accountIds.length) {
      throw new AppError(400, 'حساب المخزن غير موجود في دليل الحسابات');
    }
    const header = accounts.find((account) => (account._count?.children ?? 0) > 0);
    if (header) {
      throw new AppError(
        400,
        `الحساب ${header.code} (${header.arabicName}) حساب أب. اختر حساباً تحليلياً لكارت المخزن.`
      );
    }
  }

  if (data.parentWarehouseId) {
    const parent = await prisma.warehouse.findFirst({
      where: { id: data.parentWarehouseId, companyId, isActive: true },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError(400, 'المخزن الرئيسي غير موجود');
    }
    await assertWarehouseParentCycle(companyId, selfId, data.parentWarehouseId);
  }
}

async function assertWarehouseIdle(companyId: string, warehouseId: string) {
  const [childrenCount, stockRows, movementCount, defaultBranch] = await Promise.all([
    prisma.warehouse.count({
      where: { companyId, parentWarehouseId: warehouseId, isActive: true },
    }),
    prisma.itemWarehouseBalance.count({
      where: {
        companyId,
        warehouseId,
        OR: [{ quantityOnHand: { not: 0 } }, { reservedQuantity: { not: 0 } }],
      },
    }),
    prisma.inventoryMovement.count({
      where: { companyId, warehouseId },
    }),
    prisma.branch.findFirst({
      where: { companyId, defaultWarehouseId: warehouseId },
      select: { id: true, arabicName: true },
    }),
  ]);

  if (childrenCount > 0) {
    throw new AppError(
      400,
      'لا يمكن تعطيل أو حذف المخزن لأن تحته مخازن فرعية. انقل أو احذف الفروع أولاً.'
    );
  }
  if (stockRows > 0 || movementCount > 0) {
    throw new AppError(
      409,
      'لا يمكن تعطيل أو حذف المخزن لأن عليه رصيد أو حركات مخزنية. سوِّ الرصيد أو انقل الحركات أولاً.'
    );
  }
  if (defaultBranch) {
    throw new AppError(
      409,
      `لا يمكن تعطيل أو حذف المخزن لأنه المخزن الافتراضي للفرع «${defaultBranch.arabicName}».`
    );
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
      if (data.storeType === undefined && !data.parentWarehouseId) {
        data.storeType = 'MAIN';
      }
      await assertWarehouseRefs(companyId, data);
      const existing = await prisma.warehouse.findMany({
        where: { companyId },
        select: { id: true, code: true, isActive: true },
      });
      const requested = data.code?.trim() || '';
      if (requested) {
        const clash = existing.find(
          (row) => row.isActive && (row.code ?? '').trim() === requested
        );
        if (clash) {
          throw new AppError(409, `رقم المخزن «${requested}» مستخدم بالفعل. غيّر الرقم أو اتركه فارغًا للترقيم التلقائي.`);
        }
      }
      const code = requested || nextNumericCode(existing.map((row) => row.code));
      const warehouse = await prisma.warehouse.create({
        data: {
          companyId,
          code,
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
        throw new AppError(404, 'المخزن غير موجود');
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
          orderBy: [{ code: 'asc' }, { arabicName: 'asc' }],
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
        throw new AppError(404, 'المخزن غير موجود');
      }

      await assertWarehouseRefs(companyId, data, warehouseId);
      if (data.isActive === false && existing.isActive) {
        await assertWarehouseIdle(companyId, warehouseId);
      }
      const nextCode = data.code?.trim();
      if (nextCode && nextCode !== (existing.code ?? '').trim()) {
        const clash = await prisma.warehouse.findFirst({
          where: {
            companyId,
            isActive: true,
            id: { not: warehouseId },
            code: nextCode,
          },
          select: { id: true },
        });
        if (clash) {
          throw new AppError(409, `رقم المخزن «${nextCode}» مستخدم بالفعل.`);
        }
      }

      const warehouse = await prisma.warehouse.update({
        where: { id: warehouseId },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
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
        throw new AppError(404, 'المخزن غير موجود');
      }

      await assertWarehouseIdle(companyId, warehouseId);

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
