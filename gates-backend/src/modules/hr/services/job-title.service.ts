import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateJobTitleData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateJobTitleData extends Partial<CreateJobTitleData> {
  isActive?: boolean;
}

export class JobTitleService {
  async createJobTitle(companyId: string, data: CreateJobTitleData) {
    try {
      const jobTitle = await prisma.jobTitle.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, jobTitleId: jobTitle.id }, 'Job title created');
      return jobTitle;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating job title');
      throw error;
    }
  }

  async getJobTitleById(companyId: string, jobTitleId: string) {
    try {
      const jobTitle = await prisma.jobTitle.findFirst({
        where: {
          id: jobTitleId,
          companyId,

        },
      });

      if (!jobTitle) {
        throw new Error('Job title not found');
      }

      return jobTitle;
    } catch (error) {
      logger.error({ error, companyId, jobTitleId }, 'Error getting job title');
      throw error;
    }
  }

  async listJobTitles(
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

      const [jobTitles, total] = await Promise.all([
        prisma.jobTitle.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.jobTitle.count({ where }),
      ]);

      return {
        jobTitles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing job titles');
      throw error;
    }
  }

  async updateJobTitle(
    companyId: string,
    jobTitleId: string,
    data: UpdateJobTitleData
  ) {
    try {
      const existing = await prisma.jobTitle.findFirst({
        where: { id: jobTitleId, companyId },
      });

      if (!existing) {
        throw new Error('Job title not found');
      }

      const jobTitle = await prisma.jobTitle.update({
        where: { id: jobTitleId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, jobTitleId }, 'Job title updated');
      return jobTitle;
    } catch (error) {
      logger.error({ error, companyId, jobTitleId, data }, 'Error updating job title');
      throw error;
    }
  }

  async deleteJobTitle(companyId: string, jobTitleId: string) {
    try {
      const jobTitle = await prisma.jobTitle.findFirst({
        where: { id: jobTitleId, companyId },
      });

      if (!jobTitle) {
        throw new Error('Job title not found');
      }

      await prisma.jobTitle.update({
        where: { id: jobTitleId },
        data: { isActive: false },
      });

      logger.info({ companyId, jobTitleId }, 'Job title deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, jobTitleId }, 'Error deleting job title');
      throw error;
    }
  }
}

export const jobTitleService = new JobTitleService();
