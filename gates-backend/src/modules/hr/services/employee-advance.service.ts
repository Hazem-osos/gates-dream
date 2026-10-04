import prisma from '../../../shared/database/prisma';
import { permanentDelete } from '../../../shared/database/permanent-delete.util';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

export interface CreateEmployeeAdvanceData {
  employeeId: string;
  serial?: string;
  date: Date;
  hijriDate?: string;
  value: number;
  monthlyInstallment?: number;
  fromMonth?: string;
  toYear?: string;
  notes?: string;
  record?: string;
  paymentMethod?: string; // 'fund' | 'bank'
}

export interface UpdateEmployeeAdvanceData extends Partial<CreateEmployeeAdvanceData> {
  isActive?: boolean;
}

export class EmployeeAdvanceService {
  /**
   * Create a new employee advance
   */
  async createEmployeeAdvance(
    companyId: string,
    userId: string,
    data: CreateEmployeeAdvanceData
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Validate advance value
      if (data.value <= 0) {
        throw new Error('Advance value must be greater than 0');
      }

      const advance = await prisma.$transaction(async (tx) => {
        const created = await tx.employeeAdvance.create({
        data: {
          employeeId: data.employeeId,
          serial: data.serial,
          date: data.date,
          hijriDate: data.hijriDate,
          value: new Decimal(data.value),
          monthlyInstallment: data.monthlyInstallment
            ? new Decimal(data.monthlyInstallment)
            : null,
          fromMonth: data.fromMonth,
          toYear: data.toYear,
          notes: data.notes,
          record: data.record,
          paymentMethod: data.paymentMethod,
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
        const accounts = await hrGlAccountResolverService.resolveAccounts(companyId);
        const debitAccountId = employee.advanceAccountId || accounts.employeeAdvancesAccountId;
        const creditAccountId = accounts.accruedPayrollAccountId;
        if (debitAccountId && creditAccountId) {
          const fiscalYear = await tx.fiscalYear.findFirst({
            where: { companyId, status: 'Open', isActive: true },
            orderBy: { startDate: 'desc' },
          });
          if (!fiscalYear) {
            throw new AppError(400, 'لا توجد سنة مالية مفتوحة لترحيل السلفة');
          }
          await journalPostingService.createAndPostInTx(tx, { companyId, userId }, {
            fiscalYearId: fiscalYear.id,
            date: data.date,
            description: `صرف سلفة ${employee.arabicName}`,
            currencyCode: 'EGP',
            exchangeRate: 1,
            entryType: 'EmployeeAdvance',
            sourceType: 'HR',
            lines: journalLines([
              { accountId: debitAccountId, debit: data.value, credit: 0, description: `سلفة ${employee.arabicName}` },
              { accountId: creditAccountId, debit: 0, credit: data.value, description: `صرف سلفة ${employee.arabicName}` },
            ]),
          });
        }
        return created;
      });

      logger.info(
        { companyId, advanceId: advance.id, employeeId: data.employeeId },
        'Employee advance created'
      );
      return advance;
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error creating employee advance'
      );
      throw error;
    }
  }

  /**
   * Get employee advance by ID
   */
  async getEmployeeAdvanceById(companyId: string, advanceId: string) {
    try {
      const advance = await prisma.employeeAdvance.findFirst({
        where: {
          id: advanceId,
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

      if (!advance) {
        throw new Error('Employee advance not found');
      }

      return advance;
    } catch (error) {
      logger.error(
        { error, companyId, advanceId },
        'Error getting employee advance'
      );
      throw error;
    }
  }

  /**
   * List employee advances with pagination and filters
   */
  async listEmployeeAdvances(
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
        employee: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { serial: { contains: options.search } },
          { record: { contains: options.search } },
          { notes: { contains: options.search } },
          { employee: { arabicName: { contains: options.search } } },
          { employee: { englishName: { contains: options.search } } },
        ];
      }

      if (options.employeeId) {
        where.employeeId = options.employeeId;
      }

      if (options.startDate || options.endDate) {
        where.date = {};
        if (options.startDate) where.date.gte = options.startDate;
        if (options.endDate) where.date.lte = options.endDate;
      }

      const [advances, total] = await Promise.all([
        prisma.employeeAdvance.findMany({
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
        prisma.employeeAdvance.count({ where }),
      ]);

      return {
        advances,
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
        'Error listing employee advances'
      );
      throw error;
    }
  }

  /**
   * Update employee advance
   */
  async updateEmployeeAdvance(
    companyId: string,
    advanceId: string,
    data: UpdateEmployeeAdvanceData
  ) {
    try {
      const existing = await prisma.employeeAdvance.findFirst({
        where: {
          id: advanceId,
          employee: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Employee advance not found');
      }

      const updateData: any = {};

      if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
      if (data.value !== undefined)
        updateData.value = new Decimal(data.value);
      if (data.monthlyInstallment !== undefined)
        updateData.monthlyInstallment = data.monthlyInstallment
          ? new Decimal(data.monthlyInstallment)
          : null;
      if (data.fromMonth !== undefined) updateData.fromMonth = data.fromMonth;
      if (data.toYear !== undefined) updateData.toYear = data.toYear;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.record !== undefined) updateData.record = data.record;
      if (data.paymentMethod !== undefined)
        updateData.paymentMethod = data.paymentMethod;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const advance = await prisma.employeeAdvance.update({
        where: { id: advanceId },
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

      logger.info({ companyId, advanceId }, 'Employee advance updated');
      return advance;
    } catch (error) {
      logger.error(
        { error, companyId, advanceId, data },
        'Error updating employee advance'
      );
      throw error;
    }
  }

  /**
   * Delete employee advance
   */
  async deleteEmployeeAdvance(companyId: string, advanceId: string) {
    try {
      const advance = await prisma.employeeAdvance.findFirst({
        where: {
          id: advanceId,
          employee: {
            companyId,
          },
        },
      });

      if (!advance) {
        throw new Error('Employee advance not found');
      }

      await permanentDelete('السجل', () => prisma.employeeAdvance.delete({ where: { id: advanceId } }));

      logger.info({ companyId, advanceId }, 'Employee advance deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, advanceId },
        'Error deleting employee advance'
      );
      throw error;
    }
  }
}

export const employeeAdvanceService = new EmployeeAdvanceService();
