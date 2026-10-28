import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

export interface EOSClearanceData {
  employeeId: string;
  contractId?: string;
  clearanceDate: Date;
  hijriDate?: string;
  eosAmount: number;
  accountId?: string; // Account to credit EOS payment
  notes?: string;
}

export class EOSClearanceService {
  /**
   * Clear end of service entitlements for an employee
   */
  async clearEOSEntitlements(
    companyId: string,
    userId: string,
    data: EOSClearanceData
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

      // Calculate years of service
      const startDate = contract.contractStartDate;
      const endDate = data.clearanceDate;
      const yearsOfService =
        (endDate.getTime() - startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);

      const procedure = await prisma.$transaction(async (tx) => {
        // One EOS clearance per contract: lock the employee, then check.
        await tx.$executeRaw`SELECT id FROM employees WHERE id = ${data.employeeId} FOR UPDATE`;
        const alreadyCleared = await tx.employeeProcedure.findFirst({
          where: {
            employeeId: data.employeeId,
            employee: { companyId },
            procedureType: 'eos_clearance',
            date: { gte: contract.contractStartDate },
          },
          select: { id: true },
        });
        if (alreadyCleared) {
          throw new AppError(409, 'تمت تصفية مستحقات نهاية الخدمة لهذا العقد من قبل');
        }

        const created = await tx.employeeProcedure.create({
          data: {
            employeeId: data.employeeId,
            procedureType: 'eos_clearance',
            date: data.clearanceDate,
            amount: new Decimal(data.eosAmount),
            description: `End of Service clearance. Years of service: ${yearsOfService.toFixed(2)}. EOS Amount: ${data.eosAmount}${data.notes ? `. Notes: ${data.notes}` : ''}`,
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
          const fiscalYear = { id: await fiscalYearService.assertOpenForDate(companyId, data.clearanceDate) };
          if (!accounts.accruedPayrollAccountId) {
            throw new AppError(400, 'حساب مستحقات الرواتب غير معرّف في إعدادات الموارد البشرية');
          }
          const amount = Number(data.eosAmount);
          await journalPostingService.createAndPostInTx(
            tx,
            { companyId, userId },
            {
              fiscalYearId: fiscalYear.id,
              date: data.clearanceDate,
              description: `تصفية نهاية خدمة ${employee.arabicName}`,
              currencyCode: company?.defaultCurrency?.trim() || 'EGP',
              exchangeRate: 1,
              entryType: 'EosClearance',
              sourceType: 'HR-EOS',
              sourceId: created.id,
              lines: journalLines([
                {
                  accountId: expenseAccountId,
                  debit: amount,
                  credit: 0,
                  description: `مصروف نهاية الخدمة - ${employee.arabicName}`,
                },
                {
                  accountId: accounts.accruedPayrollAccountId,
                  debit: 0,
                  credit: amount,
                  description: `مستحق نهاية الخدمة - ${employee.arabicName}`,
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
          eosAmount: data.eosAmount,
          yearsOfService,
        },
        'EOS entitlements cleared'
      );

      return {
        procedure,
        yearsOfService: parseFloat(yearsOfService.toFixed(2)),
        eosAmount: data.eosAmount,
        clearanceDate: data.clearanceDate,
      };
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error clearing EOS entitlements');
      throw error;
    }
  }

  /**
   * Get EOS clearance history for an employee
   */
  async getEOSClearanceHistory(companyId: string, employeeId: string) {
    try {
      const procedures = await prisma.employeeProcedure.findMany({
        where: {
          employee: {
            id: employeeId,
            companyId,
          },
          procedureType: 'eos_clearance',
        },
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
        { error, companyId, employeeId },
        'Error getting EOS clearance history'
      );
      throw error;
    }
  }
}

export const eosClearanceService = new EOSClearanceService();

