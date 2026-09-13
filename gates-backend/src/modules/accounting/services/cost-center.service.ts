import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateCostCenterData {
  code: string;
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

export class CostCenterService {
  /**
   * Create a new cost center
   */
  async createCostCenter(companyId: string, data: CreateCostCenterData) {
    try {
      const costCenter = await prisma.costCenter.create({
        data: {
          companyId,
          code: data.code,
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
      logger.error({ error, companyId, data }, 'Error creating cost center');
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
        throw new Error('Cost center not found');
      }

      return costCenter;
    } catch (error) {
      logger.error({ error, companyId, costCenterId }, 'Error getting cost center');
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

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

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
        throw new Error('Cost center not found');
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
      logger.error({ error, companyId, costCenterId, data }, 'Error updating cost center');
      throw error;
    }
  }

  /**
   * Delete cost center (soft delete)
   */
  async deleteCostCenter(companyId: string, costCenterId: string) {
    try {
      const costCenter = await prisma.costCenter.findFirst({
        where: { id: costCenterId, companyId },
      });

      if (!costCenter) {
        throw new Error('Cost center not found');
      }

      await prisma.costCenter.update({
        where: { id: costCenterId },
        data: { isActive: false },
      });

      logger.info({ companyId, costCenterId }, 'Cost center deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, costCenterId }, 'Error deleting cost center');
      throw error;
    }
  }
}

export const costCenterService = new CostCenterService();
