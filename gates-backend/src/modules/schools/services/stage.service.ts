import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateStageData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateStageData extends Partial<CreateStageData> {
  isActive?: boolean;
}

export class StageService {
  async createStage(companyId: string, data: CreateStageData) {
    try {
      const stage = await prisma.stage.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, stageId: stage.id }, 'Stage created');
      return stage;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating stage');
      throw error;
    }
  }

  async getStageById(companyId: string, stageId: string) {
    try {
      const stage = await prisma.stage.findFirst({
        where: {
          id: stageId,
          companyId,

        },
      });

      if (!stage) {
        throw new Error('Stage not found');
      }

      return stage;
    } catch (error) {
      logger.error({ error, companyId, stageId }, 'Error getting stage');
      throw error;
    }
  }

  async listStages(
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

      const [stages, total] = await Promise.all([
        prisma.stage.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.stage.count({ where }),
      ]);

      return {
        stages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing stages');
      throw error;
    }
  }

  async updateStage(
    companyId: string,
    stageId: string,
    data: UpdateStageData
  ) {
    try {
      const existing = await prisma.stage.findFirst({
        where: { id: stageId, companyId },
      });

      if (!existing) {
        throw new Error('Stage not found');
      }

      const stage = await prisma.stage.update({
        where: { id: stageId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, stageId }, 'Stage updated');
      return stage;
    } catch (error) {
      logger.error({ error, companyId, stageId, data }, 'Error updating stage');
      throw error;
    }
  }

  async deleteStage(companyId: string, stageId: string) {
    try {
      const stage = await prisma.stage.findFirst({
        where: { id: stageId, companyId },
      });

      if (!stage) {
        throw new Error('Stage not found');
      }

      await prisma.stage.update({
        where: { id: stageId },
        data: { isActive: false },
      });

      logger.info({ companyId, stageId }, 'Stage deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, stageId }, 'Error deleting stage');
      throw error;
    }
  }
}

export const stageService = new StageService();
