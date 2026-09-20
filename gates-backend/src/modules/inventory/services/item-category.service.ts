import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { nextHierarchicalCode } from '../../../shared/utils/next-numeric-code';

export interface CreateItemCategoryData {
  code?: string | null;
  arabicName: string;
  englishName?: string | null;
  groupType?: string | null;
  parentCategoryId?: string | null;
  isFeatured?: boolean;
  isTaxExempt?: boolean;
  taxRate?: number | null;
  defaultInventoryAccountId?: string | null;
  defaultSalesAccountId?: string | null;
  defaultCogsAccountId?: string | null;
}

export interface UpdateItemCategoryData extends Partial<CreateItemCategoryData> {
  isActive?: boolean;
}

/**
 * Sales Invoice Enterprise Redesign: item categories exist solely to drive
 * GL-account defaulting for items created under them (see
 * item.service.ts#createItem). The three default*AccountId fields are
 * deliberately bare ids (no Prisma relation to Account), matching the
 * existing Item.mainAccountId / Customer.accountId convention elsewhere —
 * they are resolved by id lookup at posting time, not via Prisma include.
 */
export class ItemCategoryService {
  async suggestNextCategoryCode(
    companyId: string,
    parentCategoryId?: string | null
  ): Promise<string> {
    const live = { companyId, isActive: true };
    if (!parentCategoryId) {
      const roots = await prisma.itemCategory.findMany({
        where: { ...live, parentCategoryId: null },
        select: { code: true },
      });
      return nextHierarchicalCode(null, roots.map((row) => row.code));
    }

    const parent = await prisma.itemCategory.findFirst({
      where: { id: parentCategoryId, companyId, isActive: true },
      select: { code: true },
    });
    if (!parent) throw new AppError(404, 'المجموعة الرئيسية غير موجودة');

    const siblings = await prisma.itemCategory.findMany({
      where: { ...live, parentCategoryId },
      select: { code: true },
    });
    return nextHierarchicalCode(parent.code, siblings.map((row) => row.code));
  }

  /** Fill automatic serials for groups that were saved without a code. */
  private async assignMissingCategoryCodes(companyId: string) {
    const all = await prisma.itemCategory.findMany({
      where: { companyId },
      select: { id: true, code: true, parentCategoryId: true },
      orderBy: { createdAt: 'asc' },
    });
    const missing = all.filter((row) => !String(row.code ?? '').trim());
    if (!missing.length) return;

    const byId = new Map(all.map((row) => [row.id, row]));
    const used = new Set(
      all.map((row) => String(row.code ?? '').trim()).filter(Boolean)
    );

    for (const row of missing) {
      const parent = row.parentCategoryId ? byId.get(row.parentCategoryId) : undefined;
      let code = nextHierarchicalCode(parent?.code, [...used]);
      while (used.has(code)) {
        code = nextHierarchicalCode(parent?.code, [...used, code]);
      }
      await prisma.itemCategory.update({
        where: { id: row.id },
        data: { code },
      });
      row.code = code;
      used.add(code);
    }
  }

  async createItemCategory(companyId: string, data: CreateItemCategoryData) {
    try {
      if (data.parentCategoryId) {
        const parent = await prisma.itemCategory.findFirst({
          where: { id: data.parentCategoryId, companyId },
          select: { id: true },
        });
        if (!parent) throw new AppError(422, 'المجموعة الرئيسية غير موجودة');
      }
      const requested = data.code?.trim() || '';
      if (requested) {
        const clash = await prisma.itemCategory.findFirst({
          where: { companyId, code: requested },
          select: { id: true },
        });
        if (clash) {
          throw new AppError(409, `رقم المجموعة «${requested}» مستخدم بالفعل.`);
        }
      }
      const code = requested || (await this.suggestNextCategoryCode(companyId, data.parentCategoryId));
      const category = await prisma.itemCategory.create({
        data: {
          companyId,
          code,
          arabicName: data.arabicName,
          englishName: data.englishName ?? null,
          groupType: data.groupType ?? null,
          parentCategoryId: data.parentCategoryId ?? null,
          isFeatured: data.isFeatured ?? false,
          isTaxExempt: data.isTaxExempt ?? false,
          taxRate: data.isTaxExempt ? 0 : data.taxRate ?? null,
          defaultInventoryAccountId: data.defaultInventoryAccountId ?? null,
          defaultSalesAccountId: data.defaultSalesAccountId ?? null,
          defaultCogsAccountId: data.defaultCogsAccountId ?? null,
        },
      });

      logger.info({ companyId, categoryId: category.id }, 'Item category created');
      return category;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating item category');
      throw error;
    }
  }

  async getItemCategoryById(companyId: string, categoryId: string) {
    const category = await prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId },
    });

    if (!category) {
      throw new AppError(404, 'Item category not found');
    }

    return category;
  }

  async listItemCategories(
    companyId: string,
    options: { page?: number; limit?: number; search?: string; isActive?: boolean }
  ) {
    try {
      await this.assignMissingCategoryCodes(companyId);
    } catch (error) {
      logger.warn({ error, companyId }, 'Could not backfill missing item category codes');
    }
    const page = options.page || 1;
    const limit = options.limit || 100;
    const skip = (page - 1) * limit;

    const where: {
      companyId: string;
      isActive?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = { companyId };

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.search) {
      where.OR = [
        { arabicName: { contains: options.search } },
        { englishName: { contains: options.search } },
        { code: { contains: options.search } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.itemCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ arabicName: 'asc' }],
      }),
      prisma.itemCategory.count({ where }),
    ]);

    return {
      categories,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateItemCategory(
    companyId: string,
    categoryId: string,
    data: UpdateItemCategoryData
  ) {
    const existing = await prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId },
    });

    if (!existing) {
      throw new AppError(404, 'Item category not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.code !== undefined) {
      const nextCode = data.code?.trim() || null;
      if (nextCode && nextCode !== (existing.code ?? '').trim()) {
        const clash = await prisma.itemCategory.findFirst({
          where: { companyId, code: nextCode, id: { not: categoryId } },
          select: { id: true },
        });
        if (clash) {
          throw new AppError(409, `رقم المجموعة «${nextCode}» مستخدم بالفعل.`);
        }
      }
      updateData.code = nextCode ?? (await this.suggestNextCategoryCode(companyId, existing.parentCategoryId));
    }
    if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
    if (data.englishName !== undefined) updateData.englishName = data.englishName;
    if (data.defaultInventoryAccountId !== undefined) {
      updateData.defaultInventoryAccountId = data.defaultInventoryAccountId;
    }
    if (data.defaultSalesAccountId !== undefined) {
      updateData.defaultSalesAccountId = data.defaultSalesAccountId;
    }
    if (data.defaultCogsAccountId !== undefined) {
      updateData.defaultCogsAccountId = data.defaultCogsAccountId;
    }
    if (data.groupType !== undefined) updateData.groupType = data.groupType;
    if (data.parentCategoryId !== undefined) {
      if (data.parentCategoryId === categoryId) {
        throw new AppError(422, 'لا يمكن أن تكون المجموعة رئيسية لنفسها');
      }
      if (data.parentCategoryId) {
        const parent = await prisma.itemCategory.findFirst({
          where: { id: data.parentCategoryId, companyId },
          select: { id: true },
        });
        if (!parent) throw new AppError(422, 'المجموعة الرئيسية غير موجودة');
      }
      updateData.parentCategoryId = data.parentCategoryId;
    }
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.isTaxExempt !== undefined) updateData.isTaxExempt = data.isTaxExempt;
    if (data.isTaxExempt) {
      updateData.taxRate = 0;
    } else if (data.taxRate !== undefined) {
      updateData.taxRate = data.taxRate;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const category = await prisma.itemCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    logger.info({ companyId, categoryId }, 'Item category updated');
    return category;
  }

  async deleteItemCategory(companyId: string, categoryId: string) {
    const existing = await prisma.itemCategory.findFirst({
      where: { id: categoryId, companyId },
      select: { id: true, arabicName: true, code: true },
    });
    if (!existing) {
      throw new AppError(404, 'المجموعة غير موجودة');
    }

    const [childGroups, itemCount] = await Promise.all([
      prisma.itemCategory.count({ where: { companyId, parentCategoryId: categoryId } }),
      prisma.item.count({ where: { companyId, categoryId } }),
    ]);

    if (childGroups > 0) {
      throw new AppError(409, 'لا يمكن حذف المجموعة لأن تحتها مجموعات فرعية. احذف أو انقل الفرعية أولاً.');
    }
    if (itemCount > 0) {
      throw new AppError(409, 'لا يمكن حذف المجموعة لأن تحتها أصناف. انقل أو احذف الأصناف أولاً.');
    }

    try {
      await prisma.itemCategory.delete({ where: { id: categoryId } });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'P2003' || code === 'P2014') {
        throw new AppError(409, 'لا يمكن حذف المجموعة لأنها مرتبطة ببيانات أخرى.');
      }
      throw error;
    }

    logger.info({ companyId, categoryId }, 'Item category permanently deleted');
    return { success: true };
  }
}

export const itemCategoryService = new ItemCategoryService();
