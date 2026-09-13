import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateReligionData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateReligionData extends Partial<CreateReligionData> {
  isActive?: boolean;
}

export class ReligionService {
  async createReligion(companyId: string, data: CreateReligionData) {
    try {
      const religion = await prisma.religion.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, religionId: religion.id }, 'Religion created');
      return religion;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating religion');
      throw error;
    }
  }

  async getReligionById(companyId: string, religionId: string) {
    try {
      const religion = await prisma.religion.findFirst({
        where: {
          id: religionId,
          companyId,

        },
      });

      if (!religion) {
        throw new Error('Religion not found');
      }

      return religion;
    } catch (error) {
      logger.error({ error, companyId, religionId }, 'Error getting religion');
      throw error;
    }
  }

  async listReligions(
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

      const [religions, total] = await Promise.all([
        prisma.religion.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.religion.count({ where }),
      ]);

      return {
        religions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing religions');
      throw error;
    }
  }

  async updateReligion(
    companyId: string,
    religionId: string,
    data: UpdateReligionData
  ) {
    try {
      const existing = await prisma.religion.findFirst({
        where: { id: religionId, companyId },
      });

      if (!existing) {
        throw new Error('Religion not found');
      }

      const religion = await prisma.religion.update({
        where: { id: religionId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, religionId }, 'Religion updated');
      return religion;
    } catch (error) {
      logger.error({ error, companyId, religionId, data }, 'Error updating religion');
      throw error;
    }
  }

  async deleteReligion(companyId: string, religionId: string) {
    try {
      const religion = await prisma.religion.findFirst({
        where: { id: religionId, companyId },
      });

      if (!religion) {
        throw new Error('Religion not found');
      }

      await prisma.religion.update({
        where: { id: religionId },
        data: { isActive: false },
      });

      logger.info({ companyId, religionId }, 'Religion deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, religionId }, 'Error deleting religion');
      throw error;
    }
  }
}

export const religionService = new ReligionService();
