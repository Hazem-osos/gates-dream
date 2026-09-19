import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

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
  async createItemCategory(companyId: string, data: CreateItemCategoryData) {
    try {
      if (data.parentCategoryId) {
        const parent = await prisma.itemCategory.findFirst({
          where: { id: data.parentCategoryId, companyId },
          select: { id: true },
        });
        if (!parent) throw new AppError(422, 'المجموعة الرئيسية غير موجودة');
      }
      const category = await prisma.itemCategory.create({
        data: {
          companyId,
          code: data.code ?? null,
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
    if (data.code !== undefined) updateData.code = data.code;
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
}

export const itemCategoryService = new ItemCategoryService();
