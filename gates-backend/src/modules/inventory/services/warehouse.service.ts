// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { advancedFlag, nextHierarchicalCode } from '../../../shared/utils/next-numeric-code';
import {
  resolveCreateWarehouseKind,
  type WarehouseKindValue,
} from '../utils/warehouse-kind';

export interface CreateWarehouseData {
  code?: string;
  arabicName: string;
  englishName?: string;
  branchId?: string | null;
  storeType?: string | null;
  warehouseKind?: WarehouseKindValue;
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
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new AppError(400, 'حساب المخزن غير موجود في دليل الحسابات');
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
  const [
    childrenCount,
    stockRows,
    movementCount,
    defaultBranch,
    invoiceCount,
    receiptCount,
    issueCount,
    transferCount,
  ] = await Promise.all([
    prisma.warehouse.count({
      where: { companyId, parentWarehouseId: warehouseId },
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
    prisma.invoice.count({ where: { companyId, warehouseId } }),
    prisma.receipt.count({ where: { companyId, warehouseId } }),
    prisma.issue.count({ where: { companyId, warehouseId } }),
    prisma.transfer.count({
      where: {
        companyId,
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      },
    }),
  ]);

  if (childrenCount > 0) {
    throw new AppError(
      400,
      'لا يمكن حذف المخزن لأن تحته مخازن فرعية. احذف أو انقل الفروع أولاً.'
    );
  }
  if (stockRows > 0 || movementCount > 0) {
    throw new AppError(
      409,
      'لا يمكن حذف المخزن لأن عليه رصيد أو حركات مخزنية. سوِّ الرصيد أو انقل الحركات أولاً.'
    );
  }
  if (invoiceCount + receiptCount + issueCount + transferCount > 0) {
    throw new AppError(
      409,
      'لا يمكن حذف المخزن لأنه مستخدم في فواتير أو أذون أو تحويلات.'
    );
  }
  if (defaultBranch) {
    throw new AppError(
      409,
      `لا يمكن حذف المخزن لأنه المخزن الافتراضي للفرع «${defaultBranch.arabicName}».`
    );
  }
}

function warehouseLabel(row: { code?: string | null; arabicName: string }) {
  return row.code ? `${row.code} (${row.arabicName})` : row.arabicName;
}

async function assertParentCanReceiveChild(
  companyId: string,
  parentWarehouseId: string | null | undefined
) {
  if (!parentWarehouseId) return;

  const parent = await prisma.warehouse.findFirst({
    where: { id: parentWarehouseId, companyId, isActive: true },
    select: { id: true, code: true, arabicName: true, warehouseKind: true },
  });
  if (!parent) {
    throw new AppError(400, 'المخزن الرئيسي غير موجود');
  }
  if (parent.warehouseKind === 'POSTING') {
    throw new AppError(
      409,
      `لا يمكن إضافة مخزن فرعي تحت ${warehouseLabel(parent)} لأنه مخزن عمليات. مخزن العمليات تُترحَّل عليه الحركات ولا يُفرَّع منه.`
    );
  }
}

function warehouseCardFields(data: CreateWarehouseData) {
  return {
    storeType: data.storeType ?? null,
    warehouseKind: data.warehouseKind ?? 'POSTING',
    parentWarehouseId: data.parentWarehouseId || null,
    inventoryAccountId: data.inventoryAccountId || null,
    costAccountId: data.costAccountId || null,
    giftAccountId: data.giftAccountId || null,
    address: data.address?.trim() || null,
    keeperName: data.keeperName?.trim() || null,
  };
}

export class WarehouseService {
  private async isWarehouseAutoNumbering(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { advancedSettings: true },
    });
    return advancedFlag(settings?.advancedSettings, 'warehouseAutoNumbering');
  }

  async suggestNextWarehouseCode(companyId: string, parentWarehouseId?: string | null): Promise<string> {
    const live = { companyId, isActive: true };

    if (!parentWarehouseId) {
      const roots = await prisma.warehouse.findMany({
        where: { ...live, parentWarehouseId: null },
        select: { code: true },
      });
      return nextHierarchicalCode(null, roots.map((row) => row.code));
    }

    const parent = await prisma.warehouse.findFirst({
      where: { id: parentWarehouseId, companyId, isActive: true },
      select: { code: true },
    });
    if (!parent) {
      throw new AppError(404, 'المخزن الرئيسي غير موجود');
    }

    const siblings = await prisma.warehouse.findMany({
      where: { ...live, parentWarehouseId },
      select: { code: true },
    });
    return nextHierarchicalCode(parent.code, siblings.map((row) => row.code));
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(companyId: string, data: CreateWarehouseData) {
    try {
      if (data.storeType === undefined && !data.parentWarehouseId) {
        data.storeType = 'MAIN';
      }
      await assertWarehouseRefs(companyId, data);
      data.warehouseKind = resolveCreateWarehouseKind({
        parentWarehouseId: data.parentWarehouseId,
        warehouseKind: data.warehouseKind,
      });
      await assertParentCanReceiveChild(companyId, data.parentWarehouseId);
      const existing = await prisma.warehouse.findMany({
        where: { companyId },
        select: { id: true, code: true, isActive: true },
      });
      const requested = data.code?.trim() || '';
      const auto = await this.isWarehouseAutoNumbering(companyId);
      if (requested) {
        const clash = existing.find(
          (row) => row.isActive && (row.code ?? '').trim() === requested
        );
        if (clash) {
          throw new AppError(409, `رقم المخزن «${requested}» مستخدم بالفعل. غيّر الرقم أو اتركه فارغًا للترقيم التلقائي.`);
        }
      } else if (!auto) {
        throw new AppError(400, 'رقم المخزن مطلوب — الترقيم يدوي.');
      }
      const code = requested || (await this.suggestNextWarehouseCode(companyId, data.parentWarehouseId));
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
      leafOnly?: boolean;
      headerOnly?: boolean;
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

      where.isActive = options.isActive !== undefined ? options.isActive : true;

      if (options.leafOnly) {
        where.warehouseKind = 'POSTING';
        where.childWarehouses = { none: { isActive: true } };
      }
      if (options.headerOnly) {
        where.warehouseKind = 'HEADER';
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
            _count: {
              select: { childWarehouses: { where: { isActive: true } } },
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
      const nextParentId =
        data.parentWarehouseId !== undefined
          ? data.parentWarehouseId || null
          : existing.parentWarehouseId;
      if (nextParentId && nextParentId !== existing.parentWarehouseId) {
        await assertParentCanReceiveChild(companyId, nextParentId);
      }

      let nextKind = data.warehouseKind;
      if (data.warehouseKind !== undefined || data.parentWarehouseId !== undefined) {
        const requested = data.warehouseKind ?? existing.warehouseKind;
        nextKind = nextParentId
          ? requested === 'HEADER'
            ? 'HEADER'
            : 'POSTING'
          : requested === 'POSTING'
            ? 'POSTING'
            : 'HEADER';
        if (nextKind === 'POSTING') {
          const childCount = await prisma.warehouse.count({
            where: { companyId, parentWarehouseId: warehouseId, isActive: true },
          });
          if (childCount > 0) {
            throw new AppError(
              409,
              'لا يمكن تحويل المخزن إلى عمليات لأن تحته مخازن فرعية. احذف أو انقل الفرعي أولاً.'
            );
          }
        }
      }

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
          ...(nextKind !== undefined && { warehouseKind: nextKind }),
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
   * Delete warehouse permanently.
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

      try {
        await prisma.warehouse.delete({ where: { id: warehouseId } });
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: string }).code)
            : '';
        if (code === 'P2003' || code === 'P2014') {
          throw new AppError(
            409,
            'لا يمكن حذف المخزن لأنه مرتبط بحركة أو مستندات. انقل الارتباط أولاً.'
          );
        }
        throw error;
      }

      logger.info({ companyId, warehouseId }, 'Warehouse deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, warehouseId }, 'Error deleting warehouse');
      throw error;
    }
  }
}

export const warehouseService = new WarehouseService();
