import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateEOSDisbursementInput, UpdateEOSDisbursementInput } from '../schemas/eos-disbursement.schema';

export class EOSDisbursementService {
  /**
   * Create a new end of service disbursement
   */
  async createEOSDisbursement(
    companyId: string,
    userId: string,
    data: CreateEOSDisbursementInput
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Validate amount
      if (data.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const disbursement = await prisma.endOfServiceDisbursement.create({
        data: {
          companyId,
          employeeId: data.employeeId,
          serial: data.serial,
          date: data.date,
          hijriDate: data.hijriDate,
          paymentMethod: data.paymentMethod,
          vacationId: data.vacationId,
          amount: new Decimal(data.amount),
          notes: data.notes,
          record: data.record,
          isActive: true,
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
        { companyId, disbursementId: disbursement.id, employeeId: data.employeeId },
        'End of service disbursement created'
      );
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating end of service disbursement'
      );
      throw error;
    }
  }

  /**
   * Get end of service disbursement by ID
   */
  async getEOSDisbursementById(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.endOfServiceDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
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

      if (!disbursement) {
        throw new Error('End of service disbursement not found');
      }

      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error getting end of service disbursement'
      );
      throw error;
    }
  }

  /**
   * List end of service disbursements with pagination and filters
   */
  async listEOSDisbursements(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      employeeId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
        isActive: true,
      };

      if (options.employeeId) {
        where.employeeId = options.employeeId;
      }

      if (options.startDate || options.endDate) {
        where.date = {};
        if (options.startDate) {
          where.date.gte = options.startDate;
        }
        if (options.endDate) {
          where.date.lte = options.endDate;
        }
      }

      const [disbursements, total] = await Promise.all([
        prisma.endOfServiceDisbursement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
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
        }),
        prisma.endOfServiceDisbursement.count({ where }),
      ]);

      return {
        disbursements,
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
        'Error listing end of service disbursements'
      );
      throw error;
    }
  }

  /**
   * Update end of service disbursement
   */
  async updateEOSDisbursement(
    companyId: string,
    disbursementId: string,
    data: UpdateEOSDisbursementInput
  ) {
    try {
      const existing = await prisma.endOfServiceDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!existing) {
        throw new Error('End of service disbursement not found');
      }

      const updateData: any = {};

      if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
      if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
      if (data.vacationId !== undefined) updateData.vacationId = data.vacationId;
      if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.record !== undefined) updateData.record = data.record;

      const disbursement = await prisma.endOfServiceDisbursement.update({
        where: { id: disbursementId },
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

      logger.info({ companyId, disbursementId }, 'End of service disbursement updated');
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId, data },
        'Error updating end of service disbursement'
      );
      throw error;
    }
  }

  /**
   * Delete end of service disbursement (soft delete)
   */
  async deleteEOSDisbursement(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.endOfServiceDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!disbursement) {
        throw new Error('End of service disbursement not found');
      }

      await prisma.endOfServiceDisbursement.update({
        where: { id: disbursementId },
        data: { isActive: false },
      });

      logger.info({ companyId, disbursementId }, 'End of service disbursement deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error deleting end of service disbursement'
      );
      throw error;
    }
  }
}

export const eosDisbursementService = new EOSDisbursementService();

