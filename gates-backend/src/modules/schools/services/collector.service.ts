import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateCollectorData {
  serial?: string | null;
  arabicName: string;
  englishName?: string | null;
}

export type UpdateCollectorData = Partial<CreateCollectorData> & { isActive?: boolean };

export class CollectorService {
  async listCollectors(
    companyId: string,
    options: { page?: number; limit?: number; search?: string; isActive?: boolean }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options.search) {
      where.OR = [
        { arabicName: { contains: options.search } },
        { englishName: { contains: options.search } },
        { serial: { contains: options.search } },
      ];
    }

    const [collectors, total] = await Promise.all([
      prisma.collector.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ arabicName: 'asc' }],
      }),
      prisma.collector.count({ where }),
    ]);

    return {
      collectors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCollectorById(companyId: string, id: string) {
    const collector = await prisma.collector.findFirst({
      where: { id, companyId },
    });
    if (!collector) {
      throw new Error('Collector not found');
    }
    return collector;
  }

  async createCollector(companyId: string, data: CreateCollectorData) {
    try {
      const collector = await prisma.collector.create({
        data: {
          companyId,
          serial: data.serial ?? null,
          arabicName: data.arabicName,
          englishName: data.englishName ?? null,
        },
      });
      logger.info({ companyId, collectorId: collector.id }, 'Collector created');
      return collector;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating collector');
      throw error;
    }
  }

  async updateCollector(companyId: string, id: string, data: UpdateCollectorData) {
    await this.getCollectorById(companyId, id);
    try {
      const collector = await prisma.collector.update({
        where: { id },
        data: {
          ...(data.serial !== undefined ? { serial: data.serial } : {}),
          ...(data.arabicName !== undefined ? { arabicName: data.arabicName } : {}),
          ...(data.englishName !== undefined ? { englishName: data.englishName } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      });
      logger.info({ companyId, collectorId: id }, 'Collector updated');
      return collector;
    } catch (error) {
      logger.error({ error, companyId, id }, 'Error updating collector');
      throw error;
    }
  }

  async deleteCollector(companyId: string, id: string) {
    await this.getCollectorById(companyId, id);
    await prisma.collector.delete({ where: { id } });
    logger.info({ companyId, collectorId: id }, 'Collector deleted');
  }
}

export const collectorService = new CollectorService();
