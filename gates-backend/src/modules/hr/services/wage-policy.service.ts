import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { permanentDelete } from '../../../shared/database/permanent-delete.util';
import { logger } from '../../../shared/logger';

export interface CreateWagePolicyData {
  code?: string;
  arabicName: string;
  englishName?: string;
  rules?: Record<string, unknown> | null;
}

export interface UpdateWagePolicyData extends Partial<CreateWagePolicyData> {
  isActive?: boolean;
}

export class WagePolicyService {
  async createWagePolicy(companyId: string, data: CreateWagePolicyData) {
    try {
      const wagePolicy = await prisma.wagePolicy.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          rules: data.rules == null ? undefined : (data.rules as Prisma.InputJsonValue),
        },
      });

      logger.info({ companyId, wagePolicyId: wagePolicy.id }, 'Wage policy created');
      return wagePolicy;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating wage policy');
      throw error;
    }
  }

  async getWagePolicyById(companyId: string, wagePolicyId: string) {
    try {
      const wagePolicy = await prisma.wagePolicy.findFirst({
        where: {
          id: wagePolicyId,
          companyId,

        },
      });

      if (!wagePolicy) {
        throw new Error('Wage policy not found');
      }

      return wagePolicy;
    } catch (error) {
      logger.error({ error, companyId, wagePolicyId }, 'Error getting wage policy');
      throw error;
    }
  }

  async listWagePolicies(
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

      const [wagePolicies, total] = await Promise.all([
        prisma.wagePolicy.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.wagePolicy.count({ where }),
      ]);

      return {
        wagePolicies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing wage policies');
      throw error;
    }
  }

  async updateWagePolicy(
    companyId: string,
    wagePolicyId: string,
    data: UpdateWagePolicyData
  ) {
    try {
      const existing = await prisma.wagePolicy.findFirst({
        where: { id: wagePolicyId, companyId },
      });

      if (!existing) {
        throw new Error('Wage policy not found');
      }

      const wagePolicy = await prisma.wagePolicy.update({
        where: { id: wagePolicyId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, wagePolicyId }, 'Wage policy updated');
      return wagePolicy;
    } catch (error) {
      logger.error(
        { error, companyId, wagePolicyId, data },
        'Error updating wage policy'
      );
      throw error;
    }
  }

  async deleteWagePolicy(companyId: string, wagePolicyId: string) {
    try {
      const wagePolicy = await prisma.wagePolicy.findFirst({
        where: { id: wagePolicyId, companyId },
      });

      if (!wagePolicy) {
        throw new Error('Wage policy not found');
      }

      await permanentDelete('السجل', () => prisma.wagePolicy.delete({ where: { id: wagePolicyId } }));

      logger.info({ companyId, wagePolicyId }, 'Wage policy deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, wagePolicyId }, 'Error deleting wage policy');
      throw error;
    }
  }
}

export const wagePolicyService = new WagePolicyService();
