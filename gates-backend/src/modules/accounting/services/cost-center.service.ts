import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';

function retiredCostCenterCode(code: string, id: string): string {
  if (code.includes('__deleted__')) return code;
  return `${code}__deleted__${id.replace(/-/g, '').slice(0, 8)}`;
}

export interface CreateCostCenterData {
  code?: string;
  arabicName: string;
  englishName?: string;
  centerType?: string | null;
  parentId?: string | null;
  quantityBudget?: number | null;
  warning?: 'مدين' | 'دائن' | 'بدون' | null;
  budget?: number | null;
  currencyCode?: string | null;
  isActive?: boolean;
}

export interface UpdateCostCenterData extends Partial<CreateCostCenterData> {
  isActive?: boolean;
}

function centerLabel(center: { code: string; arabicName: string }): string {
  return `«${center.code} — ${center.arabicName}»`;
}

export class CostCenterService {
  private async countCostCenterMovements(companyId: string, costCenterId: string): Promise<number> {
    const [journalLines, ccMoves, invoices, invoiceLines] = await Promise.all([
      prisma.journalEntryLine.count({
        where: {
          costCenterId,
          journalEntry: { companyId, deletedAt: null, isCancelled: false },
        },
      }),
      prisma.costCenterMovement.count({
        where: { companyId, costCenterId },
      }),
      prisma.invoice.count({
        where: { companyId, costCenterId, isCancelled: false },
      }),
      prisma.invoiceLine.count({
        where: { costCenterId, invoice: { companyId, isCancelled: false } },
      }),
    ]);
    return journalLines + ccMoves + invoices + invoiceLines;
  }

  async suggestNextCostCenterCode(companyId: string, parentId?: string | null): Promise<string> {
    const live = {
      companyId,
      isActive: true,
      NOT: { code: { contains: '__deleted__' } },
    };

    if (!parentId) {
      const roots = await prisma.costCenter.findMany({
        where: { ...live, parentId: null },
        select: { code: true },
      });
      const nums = roots.map((r) => parseInt(r.code, 10)).filter((n) => !Number.isNaN(n));
      return String(nums.length ? Math.max(...nums) + 1 : 1);
    }

    const parent = await prisma.costCenter.findFirst({
      where: { id: parentId, companyId, isActive: true },
      select: { code: true },
    });
    if (!parent) {
      throw new AppError(404, 'مركز التكلفة الأب غير موجود');
    }

    const siblings = await prisma.costCenter.findMany({
      where: { ...live, parentId },
      select: { code: true },
    });
    const prefix = parent.code;
    if (siblings.length === 0) return `${prefix}1`;

    let maxSuffix = 0;
    for (const row of siblings) {
      if (!row.code.startsWith(prefix) || row.code.length <= prefix.length) continue;
      const n = parseInt(row.code.slice(prefix.length), 10);
      if (!Number.isNaN(n)) maxSuffix = Math.max(maxSuffix, n);
    }
    return `${prefix}${maxSuffix + 1}`;
  }

  /** Hidden rows still occupy @@unique([companyId, code]). Free the number. */
  private async vacateInactiveCostCenterCode(companyId: string, code: string) {
    const leftovers = await prisma.costCenter.findMany({
      where: { companyId, code, isActive: false },
      select: { id: true, code: true },
    });
    for (const row of leftovers) {
      await prisma.costCenter.update({
        where: { id: row.id },
        data: { code: retiredCostCenterCode(row.code, row.id), isActive: false },
      });
    }
  }

  private async assertUniqueCostCenterCode(
    companyId: string,
    code: string,
    exceptId?: string
  ) {
    const clash = await prisma.costCenter.findFirst({
      where: {
        companyId,
        code,
        isActive: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true, arabicName: true },
    });
    if (clash) {
      throw new AppError(
        409,
        `رقم المركز «${code}» مستخدم على مركز آخر (${clash.arabicName}). الحل: غيّر الرقم ثم احفظ.`
      );
    }
  }

  private async assertParentCanReceiveChild(
    companyId: string,
    parentId: string | undefined | null
  ) {
    if (!parentId) return;

    const parent = await prisma.costCenter.findFirst({
      where: { id: parentId, companyId, isActive: true },
      select: { id: true, code: true, arabicName: true },
    });
    if (!parent) {
      throw new AppError(
        400,
        'مركز التكلفة الأب غير موجود. الحل: حدّث الدليل ثم اختر المركز الأب من جديد.'
      );
    }

    const movementCount = await this.countCostCenterMovements(companyId, parentId);
    if (movementCount === 0) return;

    throw new AppError(
      409,
      `لا يمكن إضافة مركز فرعي تحت ${centerLabel(parent)} لأن عليه ${movementCount} حركة. المركز الذي عليه حركة يبقى تحليلياً ولا يتحول إلى أب. الحل: انقل حركاته من شاشة «نقل حركة مركز التكلفة» إلى مركز فرعي جديد، أو أنشئ المركز تحت أب آخر ليس عليه حركة.`
    );
  }

  /**
   * Create a new cost center
   */
  async createCostCenter(companyId: string, data: CreateCostCenterData) {
    try {
      await this.assertParentCanReceiveChild(companyId, data.parentId);
      let code = data.code?.trim() ?? '';
      if (!code) {
        code = await this.suggestNextCostCenterCode(companyId, data.parentId);
      }
      await this.vacateInactiveCostCenterCode(companyId, code);
      await this.assertUniqueCostCenterCode(companyId, code);

      const costCenter = await prisma.costCenter.create({
        data: {
          companyId,
          code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          centerType: data.centerType,
          parentId: data.parentId,
          quantityBudget: data.quantityBudget,
          warning: data.warning,
          budget: data.budget,
          currencyCode: data.currencyCode,
          isActive: data.isActive ?? true,
        },
        include: {
          parent: { select: { id: true, code: true, arabicName: true } },
          children: { select: { id: true, code: true, arabicName: true } },
        },
      });

      logger.info({ companyId, costCenterId: costCenter.id }, 'Cost center created');
      return costCenter;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          `رقم المركز «${data.code?.trim() || ''}» مستخدم من قبل. الحل: اترك الترقيم التلقائي أو غيّر الرقم.`
        );
      }
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, data }, 'Error creating cost center');
      }
      throw error;
    }
  }

  /**
   * Get cost center by ID
   */
  async getCostCenterById(companyId: string, costCenterId: string) {
    try {
      const costCenter = await prisma.costCenter.findFirst({
        where: {
          id: costCenterId,
          companyId,
        },
        include: {
          parent: { select: { id: true, code: true, arabicName: true, englishName: true } },
          children: { select: { id: true, code: true, arabicName: true, englishName: true } },
        },
      });

      if (!costCenter) {
        throw new AppError(404, 'مركز التكلفة غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.');
      }

      return costCenter;
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, costCenterId }, 'Error getting cost center');
      }
      throw error;
    }
  }

  /**
   * List cost centers
   */
  async listCostCenters(
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

      where.isActive = options.isActive !== undefined ? options.isActive : true;

      const [costCenters, total] = await Promise.all([
        prisma.costCenter.findMany({
          where,
          skip,
          take: limit,
          include: {
            parent: { select: { id: true, code: true, arabicName: true } },
            children: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: [{ code: 'asc' }],
        }),
        prisma.costCenter.count({ where }),
      ]);

      return {
        costCenters,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing cost centers');
      throw error;
    }
  }

  /**
   * Update cost center
   */
  async updateCostCenter(
    companyId: string,
    costCenterId: string,
    data: UpdateCostCenterData
  ) {
    try {
      const existing = await prisma.costCenter.findFirst({
        where: { id: costCenterId, companyId },
      });

      if (!existing) {
        throw new AppError(404, 'مركز التكلفة غير موجود. الحل: حدّث الدليل ثم أعد المحاولة.');
      }

      if (data.parentId !== undefined && data.parentId !== existing.parentId) {
        await this.assertParentCanReceiveChild(companyId, data.parentId);
      }
      if (data.code && data.code !== existing.code) {
        const nextCode = data.code.trim();
        await this.vacateInactiveCostCenterCode(companyId, nextCode);
        await this.assertUniqueCostCenterCode(companyId, nextCode, costCenterId);
      }

      const costCenter = await prisma.costCenter.update({
        where: { id: costCenterId },
        data: {
          ...(data.code && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.centerType !== undefined && { centerType: data.centerType }),
          ...(data.parentId !== undefined && { parentId: data.parentId }),
          ...(data.quantityBudget !== undefined && { quantityBudget: data.quantityBudget }),
          ...(data.warning !== undefined && { warning: data.warning }),
          ...(data.budget !== undefined && { budget: data.budget }),
          ...(data.currencyCode !== undefined && { currencyCode: data.currencyCode }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          parent: { select: { id: true, code: true, arabicName: true } },
          children: { select: { id: true, code: true, arabicName: true } },
        },
      });

      logger.info({ companyId, costCenterId }, 'Cost center updated');
      return costCenter;
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, costCenterId, data }, 'Error updating cost center');
      }
      throw error;
    }
  }

  /**
   * Delete cost center. Unused rows are removed; referenced rows are hidden
   * from the guide so the tree no longer shows a "deleted" center.
   */
  async deleteCostCenter(companyId: string, costCenterId: string) {
    const costCenter = await prisma.costCenter.findFirst({
      where: { id: costCenterId, companyId },
      include: {
        _count: { select: { children: { where: { isActive: true } } } },
      },
    });

    if (!costCenter) {
      throw new AppError(404, 'مركز التكلفة غير موجود');
    }

    if (costCenter._count.children > 0) {
      throw new AppError(
        422,
        `لا يمكن حذف ${centerLabel(costCenter)} لأن تحته مراكز فرعية. الحل: احذف أو انقل المراكز الفرعية أولاً ثم احذف هذا المركز.`
      );
    }

    const movementCount = await this.countCostCenterMovements(companyId, costCenterId);
    if (movementCount > 0) {
      throw new AppError(
        409,
        `لا يمكن حذف ${centerLabel(costCenter)} لأن عليه حركات. الحل: انقل الحركات من شاشة «نقل حركة مركز التكلفة» ثم احذف.`
      );
    }

    await prisma.costCenter.update({
      where: { id: costCenterId },
      data: {
        isActive: false,
        code: retiredCostCenterCode(costCenter.code, costCenter.id),
      },
    });

    try {
      await prisma.costCenter.delete({ where: { id: costCenterId } });
    } catch (error) {
      const blocked =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014');
      if (!blocked) {
        logger.error({ error, companyId, costCenterId }, 'Error deleting cost center');
        throw error;
      }
    }

    logger.info({ companyId, costCenterId }, 'Cost center deleted');
    return { success: true };
  }
}

export const costCenterService = new CostCenterService();
