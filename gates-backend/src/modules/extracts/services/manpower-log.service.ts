import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateManpowerLogData {
  projectId: string;
  date: Date;
  workerName: string;
  workerType?: string;
  hours?: number;
  wage?: number;
  total?: number;
  notes?: string;
}

export interface UpdateManpowerLogData extends Partial<CreateManpowerLogData> {}

export class ManpowerLogService {
  async createLog(companyId: string, data: CreateManpowerLogData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Calculate total if not provided
      const total = data.total || (data.hours && data.wage ? data.hours * data.wage : null);

      const log = await prisma.manpowerLog.create({
        data: {
          projectId: data.projectId,
          date: data.date,
          workerName: data.workerName,
          workerType: data.workerType,
          hours: data.hours ? new Decimal(data.hours) : null,
          wage: data.wage ? new Decimal(data.wage) : null,
          total: total ? new Decimal(total) : null,
          notes: data.notes,
        },
        include: {
          project: {
            select: {
              id: true,
              arabicName: true,
              serial: true,
            },
          },
        },
      });

      logger.info({ companyId, logId: log.id }, 'Manpower log created');
      return log;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating manpower log');
      throw error;
    }
  }

  async listLogs(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      projectId?: string;
      fromDate?: Date;
      toDate?: Date;
      workerType?: string;
      search?: string;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        project: { companyId },
      };

      if (options.projectId) {
        where.projectId = options.projectId;
      }

      if (options.workerType) {
        where.workerType = options.workerType;
      }

      if (options.fromDate || options.toDate) {
        where.date = {};
        if (options.fromDate) where.date.gte = options.fromDate;
        if (options.toDate) where.date.lte = options.toDate;
      }

      if (options.search) {
        where.workerName = { contains: options.search };
      }

      const [logs, total] = await Promise.all([
        prisma.manpowerLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
          },
        }),
        prisma.manpowerLog.count({ where }),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing manpower logs');
      throw error;
    }
  }

  async getLogById(companyId: string, id: string) {
    try {
      const log = await prisma.manpowerLog.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
        },
      });

      if (!log) {
        throw new Error('Manpower log not found');
      }

      return log;
    } catch (error) {
      logger.error({ error, companyId, logId: id }, 'Error getting manpower log');
      throw error;
    }
  }

  async updateLog(companyId: string, id: string, data: UpdateManpowerLogData) {
    try {
      const existing = await prisma.manpowerLog.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Manpower log not found');
      }

      // Calculate total if hours or wage changed
      let total = data.total;
      if (total === undefined && (data.hours !== undefined || data.wage !== undefined)) {
        const hours = data.hours !== undefined ? data.hours : Number(existing.hours || 0);
        const wage = data.wage !== undefined ? data.wage : Number(existing.wage || 0);
        total = hours * wage;
      }

      const updateData: any = {};
      if (data.date !== undefined) updateData.date = data.date;
      if (data.workerName !== undefined) updateData.workerName = data.workerName;
      if (data.workerType !== undefined) updateData.workerType = data.workerType;
      if (data.hours !== undefined) updateData.hours = data.hours ? new Decimal(data.hours) : null;
      if (data.wage !== undefined) updateData.wage = data.wage ? new Decimal(data.wage) : null;
      if (total !== undefined) updateData.total = total ? new Decimal(total) : null;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const log = await prisma.manpowerLog.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
        },
      });

      logger.info({ companyId, logId: id }, 'Manpower log updated');
      return log;
    } catch (error) {
      logger.error({ error, companyId, logId: id }, 'Error updating manpower log');
      throw error;
    }
  }

  async deleteLog(companyId: string, id: string) {
    try {
      const log = await prisma.manpowerLog.findFirst({
        where: { id, project: { companyId } },
      });

      if (!log) {
        throw new Error('Manpower log not found');
      }

      await prisma.manpowerLog.delete({
        where: { id },
      });

      logger.info({ companyId, logId: id }, 'Manpower log deleted');
    } catch (error) {
      logger.error({ error, companyId, logId: id }, 'Error deleting manpower log');
      throw error;
    }
  }
}

export const manpowerLogService = new ManpowerLogService();

