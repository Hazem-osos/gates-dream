import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreatePeriodData {
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdatePeriodData extends Partial<CreatePeriodData> {
  isActive?: boolean;
  isClosed?: boolean;
}

export class PeriodService {
  /**
   * Create a new period
   */
  async createPeriod(companyId: string, data: CreatePeriodData) {
    try {
      // Validate date range
      if (data.startDate >= data.endDate) {
        throw new Error('Start date must be before end date');
      }

      const period = await prisma.period.create({
        data: {
          companyId,
          code: data.code,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
        },
      });

      logger.info({ companyId, periodId: period.id }, 'Period created');
      return period;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating period');
      throw error;
    }
  }

  /**
   * Get period by ID
   */
  async getPeriodById(companyId: string, periodId: string) {
    try {
      const period = await prisma.period.findFirst({
        where: {
          id: periodId,
          companyId,

        },
      });

      if (!period) {
        throw new Error('Period not found');
      }

      return period;
    } catch (error) {
      logger.error({ error, companyId, periodId }, 'Error getting period');
      throw error;
    }
  }

  /**
   * Get period by code
   */
  async getPeriodByCode(companyId: string, code: string) {
    try {
      const period = await prisma.period.findFirst({
        where: {
          companyId,
          code,
        },
      });

      if (!period) {
        throw new Error('Period not found');
      }

      return period;
    } catch (error) {
      logger.error({ error, companyId, code }, 'Error getting period by code');
      throw error;
    }
  }

  /**
   * Get current active period (not closed, contains today's date)
   */
  async getCurrentPeriod(companyId: string) {
    try {
      const today = new Date();
      const period = await prisma.period.findFirst({
        where: {
          companyId,
          isActive: true,
          isClosed: false,
          startDate: { lte: today },
          endDate: { gte: today },
        },
        orderBy: { startDate: 'desc' },
      });

      if (!period) {
        throw new Error('No active period found');
      }

      return period;
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting current period');
      throw error;
    }
  }

  /**
   * List periods with pagination and filters
   */
  async listPeriods(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      isClosed?: boolean;
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
          { name: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.isClosed !== undefined) {
        where.isClosed = options.isClosed;
      }

      const [periods, total] = await Promise.all([
        prisma.period.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ startDate: 'desc' }],
        }),
        prisma.period.count({ where }),
      ]);

      return {
        periods,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing periods');
      throw error;
    }
  }

  /**
   * Update period
   */
  async updatePeriod(
    companyId: string,
    periodId: string,
    data: UpdatePeriodData
  ) {
    try {
      const existing = await prisma.period.findFirst({
        where: { id: periodId, companyId },
      });

      if (!existing) {
        throw new Error('Period not found');
      }

      // Validate date range if both dates are provided
      if (data.startDate && data.endDate && data.startDate >= data.endDate) {
        throw new Error('Start date must be before end date');
      }

      // Validate date range if updating single date
      if (data.startDate && !data.endDate && existing.endDate <= data.startDate) {
        throw new Error('Start date must be before end date');
      }

      if (data.endDate && !data.startDate && existing.startDate >= data.endDate) {
        throw new Error('Start date must be before end date');
      }

      const updateData: any = {};

      if (data.code !== undefined) updateData.code = data.code;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isClosed !== undefined) updateData.isClosed = data.isClosed;

      const period = await prisma.period.update({
        where: { id: periodId },
        data: updateData,
      });

      logger.info({ companyId, periodId }, 'Period updated');
      return period;
    } catch (error) {
      logger.error({ error, companyId, periodId, data }, 'Error updating period');
      throw error;
    }
  }

  /**
   * Close period
   */
  async closePeriod(companyId: string, periodId: string) {
    try {
      const period = await prisma.period.findFirst({
        where: { id: periodId, companyId },
      });

      if (!period) {
        throw new Error('Period not found');
      }

      if (period.isClosed) {
        throw new Error('Period is already closed');
      }

      const updated = await prisma.period.update({
        where: { id: periodId },
        data: { isClosed: true },
      });

      logger.info({ companyId, periodId }, 'Period closed');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, periodId }, 'Error closing period');
      throw error;
    }
  }

  /**
   * Delete period (soft delete)
   */
  async deletePeriod(companyId: string, periodId: string) {
    try {
      const period = await prisma.period.findFirst({
        where: { id: periodId, companyId },
      });

      if (!period) {
        throw new Error('Period not found');
      }

      await prisma.period.update({
        where: { id: periodId },
        data: { isActive: false },
      });

      logger.info({ companyId, periodId }, 'Period deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, periodId }, 'Error deleting period');
      throw error;
    }
  }
}

export const periodService = new PeriodService();
