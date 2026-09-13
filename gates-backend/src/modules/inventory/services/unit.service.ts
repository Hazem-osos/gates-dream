import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateUnitData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateUnitData extends Partial<CreateUnitData> {
  isActive?: boolean;
}

export class UnitService {
  /**
   * Create a new unit
   */
  async createUnit(companyId: string, data: CreateUnitData) {
    try {
      const unit = await prisma.unit.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, unitId: unit.id }, 'Unit created');
      return unit;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating unit');
      throw error;
    }
  }

  /**
   * Get unit by ID
   */
  async getUnitById(companyId: string, unitId: string) {
    try {
      const unit = await prisma.unit.findFirst({
        where: {
          id: unitId,
          companyId,
        },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      return unit;
    } catch (error) {
      logger.error({ error, companyId, unitId }, 'Error getting unit');
      throw error;
    }
  }

  /**
   * List units
   */
  async listUnits(
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

      const [units, total] = await Promise.all([
        prisma.unit.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.unit.count({ where }),
      ]);

      return {
        units,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing units');
      throw error;
    }
  }

  /**
   * Update unit
   */
  async updateUnit(
    companyId: string,
    unitId: string,
    data: UpdateUnitData
  ) {
    try {
      const existing = await prisma.unit.findFirst({
        where: { id: unitId, companyId },
      });

      if (!existing) {
        throw new Error('Unit not found');
      }

      const unit = await prisma.unit.update({
        where: { id: unitId },
        data: {
          ...(data.code && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, unitId }, 'Unit updated');
      return unit;
    } catch (error) {
      logger.error({ error, companyId, unitId, data }, 'Error updating unit');
      throw error;
    }
  }

  /**
   * Delete unit (soft delete)
   */
  async deleteUnit(companyId: string, unitId: string) {
    try {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, companyId },
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      await prisma.unit.update({
        where: { id: unitId },
        data: { isActive: false },
      });

      logger.info({ companyId, unitId }, 'Unit deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, unitId }, 'Error deleting unit');
      throw error;
    }
  }
}

export const unitService = new UnitService();
