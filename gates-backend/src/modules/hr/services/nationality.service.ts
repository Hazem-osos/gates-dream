import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateNationalityData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateNationalityData extends Partial<CreateNationalityData> {
  isActive?: boolean;
}

export class NationalityService {
  /**
   * Create a new nationality
   */
  async createNationality(companyId: string, data: CreateNationalityData) {
    try {
      const nationality = await prisma.nationality.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, nationalityId: nationality.id }, 'Nationality created');
      return nationality;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating nationality');
      throw error;
    }
  }

  /**
   * Get nationality by ID
   */
  async getNationalityById(companyId: string, nationalityId: string) {
    try {
      const nationality = await prisma.nationality.findFirst({
        where: {
          id: nationalityId,
          companyId,

        },
      });

      if (!nationality) {
        throw new Error('Nationality not found');
      }

      return nationality;
    } catch (error) {
      logger.error({ error, companyId, nationalityId }, 'Error getting nationality');
      throw error;
    }
  }

  /**
   * List nationalities
   */
  async listNationalities(
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

      const [nationalities, total] = await Promise.all([
        prisma.nationality.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.nationality.count({ where }),
      ]);

      return {
        nationalities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing nationalities');
      throw error;
    }
  }

  /**
   * Update nationality
   */
  async updateNationality(
    companyId: string,
    nationalityId: string,
    data: UpdateNationalityData
  ) {
    try {
      const existing = await prisma.nationality.findFirst({
        where: { id: nationalityId, companyId },
      });

      if (!existing) {
        throw new Error('Nationality not found');
      }

      const nationality = await prisma.nationality.update({
        where: { id: nationalityId },
        data: {
          ...(data.code && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, nationalityId }, 'Nationality updated');
      return nationality;
    } catch (error) {
      logger.error({ error, companyId, nationalityId, data }, 'Error updating nationality');
      throw error;
    }
  }

  /**
   * Delete nationality (soft delete)
   */
  async deleteNationality(companyId: string, nationalityId: string) {
    try {
      const nationality = await prisma.nationality.findFirst({
        where: { id: nationalityId, companyId },
      });

      if (!nationality) {
        throw new Error('Nationality not found');
      }

      await prisma.nationality.update({
        where: { id: nationalityId },
        data: { isActive: false },
      });

      logger.info({ companyId, nationalityId }, 'Nationality deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, nationalityId }, 'Error deleting nationality');
      throw error;
    }
  }
}

export const nationalityService = new NationalityService();
