import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateMaritalStatusData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateMaritalStatusData extends Partial<CreateMaritalStatusData> {
  isActive?: boolean;
}

export class MaritalStatusService {
  async createMaritalStatus(companyId: string, data: CreateMaritalStatusData) {
    try {
      const maritalStatus = await prisma.maritalStatus.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, maritalStatusId: maritalStatus.id }, 'Marital status created');
      return maritalStatus;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating marital status');
      throw error;
    }
  }

  async getMaritalStatusById(companyId: string, maritalStatusId: string) {
    try {
      const maritalStatus = await prisma.maritalStatus.findFirst({
        where: {
          id: maritalStatusId,
          companyId,

        },
      });

      if (!maritalStatus) {
        throw new Error('Marital status not found');
      }

      return maritalStatus;
    } catch (error) {
      logger.error({ error, companyId, maritalStatusId }, 'Error getting marital status');
      throw error;
    }
  }

  async listMaritalStatuses(
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

      const [maritalStatuses, total] = await Promise.all([
        prisma.maritalStatus.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.maritalStatus.count({ where }),
      ]);

      return {
        maritalStatuses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing marital statuses');
      throw error;
    }
  }

  async updateMaritalStatus(
    companyId: string,
    maritalStatusId: string,
    data: UpdateMaritalStatusData
  ) {
    try {
      const existing = await prisma.maritalStatus.findFirst({
        where: { id: maritalStatusId, companyId },
      });

      if (!existing) {
        throw new Error('Marital status not found');
      }

      const maritalStatus = await prisma.maritalStatus.update({
        where: { id: maritalStatusId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, maritalStatusId }, 'Marital status updated');
      return maritalStatus;
    } catch (error) {
      logger.error(
        { error, companyId, maritalStatusId, data },
        'Error updating marital status'
      );
      throw error;
    }
  }

  async deleteMaritalStatus(companyId: string, maritalStatusId: string) {
    try {
      const maritalStatus = await prisma.maritalStatus.findFirst({
        where: { id: maritalStatusId, companyId },
      });

      if (!maritalStatus) {
        throw new Error('Marital status not found');
      }

      await prisma.maritalStatus.update({
        where: { id: maritalStatusId },
        data: { isActive: false },
      });

      logger.info({ companyId, maritalStatusId }, 'Marital status deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, maritalStatusId },
        'Error deleting marital status'
      );
      throw error;
    }
  }
}

export const maritalStatusService = new MaritalStatusService();
