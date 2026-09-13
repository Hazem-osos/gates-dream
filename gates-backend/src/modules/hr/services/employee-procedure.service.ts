import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateEmployeeProcedureData {
  employeeId: string;
  serial?: string;
  procedureType: string; // warning/reward/penalty/transfer/promotion/etc.
  date: Date;
  hijriDate?: string;
  description?: string;
  amount?: number;
  unit?: string; // e.g., "جنية", "دولار", "نسبة"
  reason?: string;
  createdBy: string;
}

export interface UpdateEmployeeProcedureData {
  serial?: string;
  procedureType?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  amount?: number;
  unit?: string;
  reason?: string;
}

export class EmployeeProcedureService {
  /**
   * Create a new employee procedure
   */
  async createEmployeeProcedure(
    companyId: string,
    data: CreateEmployeeProcedureData
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      const procedure = await prisma.employeeProcedure.create({
        data: {
          employeeId: data.employeeId,
          serial: data.serial,
          procedureType: data.procedureType,
          date: data.date,
          hijriDate: data.hijriDate,
          description: data.description,
          amount: data.amount ? new Decimal(data.amount) : null,
          unit: data.unit,
          reason: data.reason,
          createdBy: data.createdBy,
        },
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      logger.info(
        { companyId, procedureId: procedure.id, employeeId: data.employeeId },
        'Employee procedure created'
      );
      return procedure;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating employee procedure'
      );
      throw error;
    }
  }

  /**
   * Get employee procedure by ID
   */
  async getEmployeeProcedureById(
    companyId: string,
    procedureId: string
  ) {
    try {
      const procedure = await prisma.employeeProcedure.findFirst({
        where: {
          id: procedureId,
          employee: {
            companyId,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!procedure) {
        throw new Error('Employee procedure not found');
      }

      return procedure;
    } catch (error) {
      logger.error(
        { error, companyId, procedureId },
        'Error getting employee procedure'
      );
      throw error;
    }
  }

  /**
   * List employee procedures with pagination and filters
   */
  async listEmployeeProcedures(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      employeeId?: string;
      procedureType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        employee: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { description: { contains: options.search } },
          { employee: { arabicName: { contains: options.search } } },
          { employee: { englishName: { contains: options.search } } },
        ];
      }

      if (options.employeeId) {
        where.employeeId = options.employeeId;
      }

      if (options.procedureType) {
        where.procedureType = options.procedureType;
      }

      if (options.startDate || options.endDate) {
        where.date = {};
        if (options.startDate) where.date.gte = options.startDate;
        if (options.endDate) where.date.lte = options.endDate;
      }

      const [procedures, total] = await Promise.all([
        prisma.employeeProcedure.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            employee: {
              select: {
                id: true,
                serial: true,
                employeeId: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.employeeProcedure.count({ where }),
      ]);

      return {
        procedures,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(
        { error, companyId, options },
        'Error listing employee procedures'
      );
      throw error;
    }
  }

  /**
   * Update employee procedure
   */
  async updateEmployeeProcedure(
    companyId: string,
    procedureId: string,
    data: UpdateEmployeeProcedureData
  ) {
    try {
      const existing = await prisma.employeeProcedure.findFirst({
        where: {
          id: procedureId,
          employee: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Employee procedure not found');
      }

      const updateData: any = {};

      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.procedureType !== undefined)
        updateData.procedureType = data.procedureType;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.amount !== undefined)
        updateData.amount = data.amount ? new Decimal(data.amount) : null;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.reason !== undefined) updateData.reason = data.reason;

      const procedure = await prisma.employeeProcedure.update({
        where: { id: procedureId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      logger.info({ companyId, procedureId }, 'Employee procedure updated');
      return procedure;
    } catch (error) {
      logger.error(
        { error, companyId, procedureId, data },
        'Error updating employee procedure'
      );
      throw error;
    }
  }

  /**
   * Delete employee procedure
   */
  async deleteEmployeeProcedure(companyId: string, procedureId: string) {
    try {
      const procedure = await prisma.employeeProcedure.findFirst({
        where: {
          id: procedureId,
          employee: {
            companyId,
          },
        },
      });

      if (!procedure) {
        throw new Error('Employee procedure not found');
      }

      await prisma.employeeProcedure.delete({
        where: { id: procedureId },
      });

      logger.info({ companyId, procedureId }, 'Employee procedure deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, procedureId },
        'Error deleting employee procedure'
      );
      throw error;
    }
  }
}

export const employeeProcedureService = new EmployeeProcedureService();
