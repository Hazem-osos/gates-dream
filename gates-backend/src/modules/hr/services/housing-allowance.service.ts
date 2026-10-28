import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

export interface HousingAllowanceClearanceData {
  employeeId: string;
  contractId?: string;
  periodYear: string;
  periodMonth: string;
  allowanceAmount: number;
  date: Date;
  hijriDate?: string;
  accountId?: string; // Account to credit housing allowance payment
  notes?: string;
}

export class HousingAllowanceService {
  /**
   * Clear housing allowance for an employee
   */
  async clearHousingAllowance(
    companyId: string,
    userId: string,
    data: HousingAllowanceClearanceData
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
        include: {
          contracts: {
            where: {
              isActive: true,
              ...(data.contractId ? { id: data.contractId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!employee) {
        throw new AppError(404, 'الموظف غير موجود');
      }

      const contract = employee.contracts[0];
      if (!contract) {
        throw new AppError(404, 'لا يوجد عقد ساري لهذا الموظف');
      }

      // The period defaults to the month of the document date (the API schema
      // never carried periodYear/periodMonth, which made the check below
      // build an invalid date and fail every request).
      const docDate = new Date(data.date);
      const year = data.periodYear ? parseInt(data.periodYear, 10) : docDate.getUTCFullYear();
      const month = data.periodMonth ? parseInt(data.periodMonth, 10) : docDate.getUTCMonth() + 1;
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        throw new AppError(422, 'فترة بدل السكن غير صالحة');
      }
      data.periodYear = String(year);
      data.periodMonth = String(month).padStart(2, '0');
      const periodStart = new Date(Date.UTC(year, month - 1, 1));
      const periodEnd = new Date(Date.UTC(year, month, 1));

      const procedure = await prisma.$transaction(async (tx) => {
        // Serialise clearances per employee, then check inside the lock.
        await tx.$executeRaw`SELECT id FROM employees WHERE id = ${data.employeeId} FOR UPDATE`;
        const existingProcedure = await tx.employeeProcedure.findFirst({
          where: {
            employeeId: data.employeeId,
            employee: { companyId },
            procedureType: 'housing_allowance',
            date: { gte: periodStart, lt: periodEnd },
          },
        });
        if (existingProcedure) {
          throw new AppError(409, 'تمت تصفية بدل السكن لهذا الموظف عن نفس الشهر من قبل');
        }

        const created = await tx.employeeProcedure.create({
          data: {
            employeeId: data.employeeId,
            procedureType: 'housing_allowance',
            date: data.date,
            amount: new Decimal(data.allowanceAmount),
            description: `Housing allowance clearance for ${data.periodYear}-${data.periodMonth}. Amount: ${data.allowanceAmount}${data.notes ? `. Notes: ${data.notes}` : ''}`,
            createdBy: userId,
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

        {
          const accounts = await hrGlAccountResolverService.resolveAccounts(companyId);
          const expenseAccountId = data.accountId || accounts.salariesExpenseAccountId;
          const account = await tx.account.findFirst({
            where: { id: expenseAccountId, companyId },
          });

          if (!account) {
            throw new AppError(404, 'حساب المصروف غير موجود');
          }

          const company = await tx.companySettings.findUnique({ where: { companyId }, select: { defaultCurrency: true } });
          const fiscalYear = { id: await fiscalYearService.assertOpenForDate(companyId, data.date) };
          if (!accounts.accruedPayrollAccountId) {
            throw new AppError(400, 'حساب مستحقات الرواتب غير معرّف في إعدادات الموارد البشرية');
          }
          const amount = Number(data.allowanceAmount);
          await journalPostingService.createAndPostInTx(
            tx,
            { companyId, userId },
            {
              fiscalYearId: fiscalYear.id,
              date: data.date,
              description: `تصفية بدل سكن ${employee.arabicName} ${data.periodYear}-${data.periodMonth}`,
              currencyCode: company?.defaultCurrency?.trim() || 'EGP',
              exchangeRate: 1,
              entryType: 'HousingAllowance',
              sourceType: 'HR-HOUSING',
              sourceId: created.id,
              lines: journalLines([
                {
                  accountId: expenseAccountId,
                  debit: amount,
                  credit: 0,
                  description: `مصروف بدل السكن - ${employee.arabicName}`,
                },
                {
                  accountId: accounts.accruedPayrollAccountId,
                  debit: 0,
                  credit: amount,
                  description: `مستحق بدل السكن - ${employee.arabicName}`,
                },
              ]),
            }
          );
        }

        return created;
      });

      logger.info(
        {
          companyId,
          employeeId: data.employeeId,
          contractId: contract.id,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
          allowanceAmount: data.allowanceAmount,
        },
        'Housing allowance cleared'
      );

      return {
        procedure,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        allowanceAmount: data.allowanceAmount,
        date: data.date,
      };
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error clearing housing allowance'
      );
      throw error;
    }
  }

  /**
   * Get housing allowance clearance history for an employee
   */
  async getHousingAllowanceHistory(
    companyId: string,
    employeeId: string,
    periodYear?: string,
    periodMonth?: string
  ) {
    try {
      const where: any = {
        employee: {
          id: employeeId,
          companyId,
        },
        procedureType: 'housing_allowance',
      };

      if (periodYear && periodMonth) {
        const nextMonth = parseInt(periodMonth) + 1;
        const nextMonthStr = nextMonth > 12 
          ? `01` 
          : String(nextMonth).padStart(2, '0');
        const nextYear = nextMonth > 12 
          ? String(parseInt(periodYear) + 1) 
          : periodYear;
        where.date = {
          gte: new Date(`${periodYear}-${periodMonth}-01`),
          lt: new Date(`${nextYear}-${nextMonthStr}-01`),
        };
      }

      const procedures = await prisma.employeeProcedure.findMany({
        where,
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
      });

      return procedures;
    } catch (error) {
      logger.error(
        { error, companyId, employeeId, periodYear, periodMonth },
        'Error getting housing allowance history'
      );
      throw error;
    }
  }
}

export const housingAllowanceService = new HousingAllowanceService();

