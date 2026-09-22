import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

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
      const code = data.code?.trim() || null;
      if (code) {
        const existing = await prisma.unit.findFirst({
          where: { companyId, code },
        });
        if (existing?.isActive) {
          throw new AppError(409, `كود الوحدة «${code}» مستخدم بالفعل.`);
        }
        if (existing && !existing.isActive) {
          const restored = await prisma.unit.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              arabicName: data.arabicName,
              englishName: data.englishName,
            },
          });
          logger.info({ companyId, unitId: restored.id }, 'Inactive unit restored');
          return restored;
        }
      }

      const unit = await prisma.unit.create({
        data: {
          companyId,
          code,
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
        throw new AppError(404, 'الوحدة غير موجودة');
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

      where.isActive = options.isActive !== undefined ? options.isActive : true;

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
        throw new AppError(404, 'الوحدة غير موجودة');
      }

      const nextCode = data.code !== undefined ? data.code?.trim() || null : existing.code;
      if (nextCode && nextCode !== existing.code) {
        const clash = await prisma.unit.findFirst({
          where: { companyId, code: nextCode, id: { not: unitId } },
          select: { id: true },
        });
        if (clash) {
          throw new AppError(409, `كود الوحدة «${nextCode}» مستخدم بالفعل.`);
        }
      }

      const unit = await prisma.unit.update({
        where: { id: unitId },
        data: {
          ...(data.code !== undefined && { code: nextCode }),
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
   * Permanent delete
   */
  async deleteUnit(companyId: string, unitId: string) {
    try {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, companyId },
      });

      if (!unit) {
        throw new AppError(404, 'الوحدة غير موجودة');
      }

      const itemUnitCount = await prisma.itemUnit.count({
        where: { unitId },
      });
      if (itemUnitCount > 0) {
        throw new AppError(
          409,
          'لا يمكن حذف الوحدة لأنها مربوطة بأصناف. فك الربط من بطاقة الصنف أولاً.'
        );
      }

      try {
        await prisma.unit.delete({ where: { id: unitId } });
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: string }).code)
            : '';
        if (code === 'P2003' || code === 'P2014') {
          throw new AppError(409, 'لا يمكن حذف الوحدة لأنها مرتبطة ببيانات أخرى.');
        }
        throw error;
      }

      logger.info({ companyId, unitId }, 'Unit permanently deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, unitId }, 'Error deleting unit');
      throw error;
    }
  }
}

export const unitService = new UnitService();
