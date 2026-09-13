import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateJobCadreData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateJobCadreData extends Partial<CreateJobCadreData> {
  isActive?: boolean;
}

export class JobCadreService {
  async createJobCadre(companyId: string, data: CreateJobCadreData) {
    try {
      const jobCadre = await prisma.jobCadre.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, jobCadreId: jobCadre.id }, 'Job cadre created');
      return jobCadre;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating job cadre');
      throw error;
    }
  }

  async getJobCadreById(companyId: string, jobCadreId: string) {
    try {
      const jobCadre = await prisma.jobCadre.findFirst({
        where: {
          id: jobCadreId,
          companyId,

        },
      });

      if (!jobCadre) {
        throw new Error('Job cadre not found');
      }

      return jobCadre;
    } catch (error) {
      logger.error({ error, companyId, jobCadreId }, 'Error getting job cadre');
      throw error;
    }
  }

  async listJobCadres(
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

      const [jobCadres, total] = await Promise.all([
        prisma.jobCadre.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.jobCadre.count({ where }),
      ]);

      return {
        jobCadres,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing job cadres');
      throw error;
    }
  }

  async updateJobCadre(
    companyId: string,
    jobCadreId: string,
    data: UpdateJobCadreData
  ) {
    try {
      const existing = await prisma.jobCadre.findFirst({
        where: { id: jobCadreId, companyId },
      });

      if (!existing) {
        throw new Error('Job cadre not found');
      }

      const jobCadre = await prisma.jobCadre.update({
        where: { id: jobCadreId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, jobCadreId }, 'Job cadre updated');
      return jobCadre;
    } catch (error) {
      logger.error({ error, companyId, jobCadreId, data }, 'Error updating job cadre');
      throw error;
    }
  }

  async deleteJobCadre(companyId: string, jobCadreId: string) {
    try {
      const jobCadre = await prisma.jobCadre.findFirst({
        where: { id: jobCadreId, companyId },
      });

      if (!jobCadre) {
        throw new Error('Job cadre not found');
      }

      await prisma.jobCadre.update({
        where: { id: jobCadreId },
        data: { isActive: false },
      });

      logger.info({ companyId, jobCadreId }, 'Job cadre deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, jobCadreId }, 'Error deleting job cadre');
      throw error;
    }
  }
}

export const jobCadreService = new JobCadreService();
