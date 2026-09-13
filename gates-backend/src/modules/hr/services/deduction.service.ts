import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateDeductionData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateDeductionData extends Partial<CreateDeductionData> {
  isActive?: boolean;
}

export class DeductionService {
  async createDeduction(companyId: string, data: CreateDeductionData) {
    try {
      const deduction = await prisma.deduction.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, deductionId: deduction.id }, 'Deduction created');
      return deduction;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating deduction');
      throw error;
    }
  }

  async getDeductionById(companyId: string, deductionId: string) {
    try {
      const deduction = await prisma.deduction.findFirst({
        where: {
          id: deductionId,
          companyId,

        },
      });

      if (!deduction) {
        throw new Error('Deduction not found');
      }

      return deduction;
    } catch (error) {
      logger.error({ error, companyId, deductionId }, 'Error getting deduction');
      throw error;
    }
  }

  async listDeductions(
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

      const [deductions, total] = await Promise.all([
        prisma.deduction.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.deduction.count({ where }),
      ]);

      return {
        deductions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing deductions');
      throw error;
    }
  }

  async updateDeduction(
    companyId: string,
    deductionId: string,
    data: UpdateDeductionData
  ) {
    try {
      const existing = await prisma.deduction.findFirst({
        where: { id: deductionId, companyId },
      });

      if (!existing) {
        throw new Error('Deduction not found');
      }

      const deduction = await prisma.deduction.update({
        where: { id: deductionId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, deductionId }, 'Deduction updated');
      return deduction;
    } catch (error) {
      logger.error(
        { error, companyId, deductionId, data },
        'Error updating deduction'
      );
      throw error;
    }
  }

  async deleteDeduction(companyId: string, deductionId: string) {
    try {
      const deduction = await prisma.deduction.findFirst({
        where: { id: deductionId, companyId },
      });

      if (!deduction) {
        throw new Error('Deduction not found');
      }

      await prisma.deduction.update({
        where: { id: deductionId },
        data: { isActive: false },
      });

      logger.info({ companyId, deductionId }, 'Deduction deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, deductionId }, 'Error deleting deduction');
      throw error;
    }
  }
}

export const deductionService = new DeductionService();
