import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateAllowanceData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateAllowanceData extends Partial<CreateAllowanceData> {
  isActive?: boolean;
}

export class AllowanceService {
  async createAllowance(companyId: string, data: CreateAllowanceData) {
    try {
      const allowance = await prisma.allowance.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, allowanceId: allowance.id }, 'Allowance created');
      return allowance;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating allowance');
      throw error;
    }
  }

  async getAllowanceById(companyId: string, allowanceId: string) {
    try {
      const allowance = await prisma.allowance.findFirst({
        where: {
          id: allowanceId,
          companyId,

        },
      });

      if (!allowance) {
        throw new Error('Allowance not found');
      }

      return allowance;
    } catch (error) {
      logger.error({ error, companyId, allowanceId }, 'Error getting allowance');
      throw error;
    }
  }

  async listAllowances(
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

      const [allowances, total] = await Promise.all([
        prisma.allowance.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.allowance.count({ where }),
      ]);

      return {
        allowances,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing allowances');
      throw error;
    }
  }

  async updateAllowance(
    companyId: string,
    allowanceId: string,
    data: UpdateAllowanceData
  ) {
    try {
      const existing = await prisma.allowance.findFirst({
        where: { id: allowanceId, companyId },
      });

      if (!existing) {
        throw new Error('Allowance not found');
      }

      const allowance = await prisma.allowance.update({
        where: { id: allowanceId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, allowanceId }, 'Allowance updated');
      return allowance;
    } catch (error) {
      logger.error(
        { error, companyId, allowanceId, data },
        'Error updating allowance'
      );
      throw error;
    }
  }

  async deleteAllowance(companyId: string, allowanceId: string) {
    try {
      const allowance = await prisma.allowance.findFirst({
        where: { id: allowanceId, companyId },
      });

      if (!allowance) {
        throw new Error('Allowance not found');
      }

      await prisma.allowance.update({
        where: { id: allowanceId },
        data: { isActive: false },
      });

      logger.info({ companyId, allowanceId }, 'Allowance deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, allowanceId }, 'Error deleting allowance');
      throw error;
    }
  }
}

export const allowanceService = new AllowanceService();
