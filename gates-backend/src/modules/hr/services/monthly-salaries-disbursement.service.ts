import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { CreateMonthlySalariesDisbursementInput, UpdateMonthlySalariesDisbursementInput } from '../schemas/monthly-salaries-disbursement.schema';

export class MonthlySalariesDisbursementService {
  /**
   * Create a new monthly salaries disbursement
   */
  async createMonthlySalariesDisbursement(
    companyId: string,
    userId: string,
    data: CreateMonthlySalariesDisbursementInput
  ) {
    try {
      const disbursement = await prisma.monthlySalariesDisbursement.create({
        data: {
          companyId,
          serial: data.serial,
          month: data.month,
          year: data.year,
          notes: data.notes,
          record: data.record,
          isActive: true,
        },
      });

      logger.info(
        { companyId, disbursementId: disbursement.id, month: data.month, year: data.year },
        'Monthly salaries disbursement created'
      );
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating monthly salaries disbursement'
      );
      throw error;
    }
  }

  /**
   * Get monthly salaries disbursement by ID
   */
  async getMonthlySalariesDisbursementById(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.monthlySalariesDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!disbursement) {
        throw new Error('Monthly salaries disbursement not found');
      }

      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error getting monthly salaries disbursement'
      );
      throw error;
    }
  }

  /**
   * List monthly salaries disbursements with pagination and filters
   */
  async listMonthlySalariesDisbursements(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      month?: string;
      year?: string;
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

      if (options.month) {
        where.month = options.month;
      }

      if (options.year) {
        where.year = options.year;
      }

      const [disbursements, total] = await Promise.all([
        prisma.monthlySalariesDisbursement.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.monthlySalariesDisbursement.count({ where }),
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
        'Error listing monthly salaries disbursements'
      );
      throw error;
    }
  }

  /**
   * Update monthly salaries disbursement
   */
  async updateMonthlySalariesDisbursement(
    companyId: string,
    disbursementId: string,
    data: UpdateMonthlySalariesDisbursementInput
  ) {
    try {
      const existing = await prisma.monthlySalariesDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!existing) {
        throw new Error('Monthly salaries disbursement not found');
      }

      const updateData: any = {};

      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.month !== undefined) updateData.month = data.month;
      if (data.year !== undefined) updateData.year = data.year;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.record !== undefined) updateData.record = data.record;

      const disbursement = await prisma.monthlySalariesDisbursement.update({
        where: { id: disbursementId },
        data: updateData,
      });

      logger.info({ companyId, disbursementId }, 'Monthly salaries disbursement updated');
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId, data },
        'Error updating monthly salaries disbursement'
      );
      throw error;
    }
  }

  /**
   * Delete monthly salaries disbursement (soft delete)
   */
  async deleteMonthlySalariesDisbursement(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.monthlySalariesDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!disbursement) {
        throw new Error('Monthly salaries disbursement not found');
      }

      await prisma.monthlySalariesDisbursement.update({
        where: { id: disbursementId },
        data: { isActive: false },
      });

      logger.info({ companyId, disbursementId }, 'Monthly salaries disbursement deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error deleting monthly salaries disbursement'
      );
      throw error;
    }
  }
}

export const monthlySalariesDisbursementService = new MonthlySalariesDisbursementService();

