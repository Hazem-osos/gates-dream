import prisma from '../../../shared/database/prisma';
import { permanentDelete } from '../../../shared/database/permanent-delete.util';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { hrEntitlementPayoutService } from './hr-entitlement-payout.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateAnnualLeaveDisbursementInput, UpdateAnnualLeaveDisbursementInput } from '../schemas/annual-leave-disbursement.schema';

export class AnnualLeaveDisbursementService {
  /**
   * Create a new annual leave entitlements disbursement
   */
  async createAnnualLeaveDisbursement(
    companyId: string,
    userId: string,
    data: CreateAnnualLeaveDisbursementInput
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new AppError(404, 'الموظف غير موجود');
      }

      // Validate amount
      if (data.amount <= 0) {
        throw new AppError(422, 'قيمة الصرف يجب أن تكون أكبر من صفر');
      }

      const prepared = await hrEntitlementPayoutService.prepare(companyId, data.date, {
        safeId: data.safeId,
        bankAccountId: data.bankAccountId,
      });

      const disbursement = await prisma.$transaction(async (tx) => {
      const row = await tx.annualLeaveEntitlementsDisbursement.create({
        data: {
          companyId,
          employeeId: data.employeeId,
          serial: data.serial,
          date: data.date,
          hijriDate: data.hijriDate,
          paymentMethod: data.safeId ? 'fund' : 'bank',
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
      await hrEntitlementPayoutService.postInTx(tx, {
        companyId,
        userId,
        kind: 'LEAVE',
        disbursementId: row.id,
        employeeName: employee.arabicName,
        amount: data.amount,
        date: data.date,
        prepared,
      });
      return row;
      });

      logger.info(
        { companyId, disbursementId: disbursement.id, employeeId: data.employeeId },
        'Annual leave entitlements disbursement created'
      );
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating annual leave entitlements disbursement'
      );
      throw error;
    }
  }

  /**
   * Get annual leave entitlements disbursement by ID
   */
  async getAnnualLeaveDisbursementById(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.annualLeaveEntitlementsDisbursement.findFirst({
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
        throw new Error('Annual leave entitlements disbursement not found');
      }

      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error getting annual leave entitlements disbursement'
      );
      throw error;
    }
  }

  /**
   * List annual leave entitlements disbursements with pagination and filters
   */
  async listAnnualLeaveDisbursements(
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
        prisma.annualLeaveEntitlementsDisbursement.findMany({
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
        prisma.annualLeaveEntitlementsDisbursement.count({ where }),
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
        'Error listing annual leave entitlements disbursements'
      );
      throw error;
    }
  }

  /**
   * Update annual leave entitlements disbursement
   */
  async updateAnnualLeaveDisbursement(
    companyId: string,
    disbursementId: string,
    data: UpdateAnnualLeaveDisbursementInput
  ) {
    try {
      const existing = await prisma.annualLeaveEntitlementsDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!existing) {
        throw new Error('Annual leave entitlements disbursement not found');
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

      const disbursement = await prisma.annualLeaveEntitlementsDisbursement.update({
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

      logger.info({ companyId, disbursementId }, 'Annual leave entitlements disbursement updated');
      return disbursement;
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId, data },
        'Error updating annual leave entitlements disbursement'
      );
      throw error;
    }
  }

  /**
   * Delete permanently (blocked if referenced)
   */
  async deleteAnnualLeaveDisbursement(companyId: string, disbursementId: string) {
    try {
      const disbursement = await prisma.annualLeaveEntitlementsDisbursement.findFirst({
        where: {
          id: disbursementId,
          companyId,
          isActive: true,
        },
      });

      if (!disbursement) {
        throw new Error('Annual leave entitlements disbursement not found');
      }

      await permanentDelete('السجل', () => prisma.annualLeaveEntitlementsDisbursement.delete({ where: { id: disbursementId } }));

      logger.info({ companyId, disbursementId }, 'Annual leave entitlements disbursement deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, disbursementId },
        'Error deleting annual leave entitlements disbursement'
      );
      throw error;
    }
  }

  /**
   * Cancel a disbursement: claim it (isActive true -> false) and reverse its
   * payout journal in one transaction. A second concurrent cancel gets 409.
   */
  async cancelAnnualLeaveDisbursement(companyId: string, userId: string, disbursementId: string) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.annualLeaveEntitlementsDisbursement.updateMany({
        where: { id: disbursementId, companyId, isActive: true },
        data: { isActive: false },
      });
      if (claimed.count !== 1) {
        const exists = await tx.annualLeaveEntitlementsDisbursement.findFirst({ where: { id: disbursementId, companyId }, select: { id: true } });
        throw new AppError(exists ? 409 : 404, exists ? 'تم إلغاء هذا الصرف بالفعل' : 'سجل الصرف غير موجود');
      }
      const reversed = await hrEntitlementPayoutService.reverseInTx(tx, {
        companyId,
        userId,
        kind: 'LEAVE',
        disbursementId,
      });
      logger.info({ companyId, disbursementId, reversed }, 'Annual leave disbursement cancelled');
      return { id: disbursementId, cancelled: true, journalReversed: reversed };
    });
  }
}

export const annualLeaveDisbursementService = new AnnualLeaveDisbursementService();

