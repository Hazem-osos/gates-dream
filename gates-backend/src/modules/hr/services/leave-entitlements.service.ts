import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { hrGlAccountResolverService } from './hr-gl-account-resolver.service';
import type { AnnualLeaveClearanceInput } from '../schemas/leave-entitlements.schema';

export interface LeaveEntitlementsDisbursementData {
  employeeId: string;
  contractId?: string;
  year: string;
  entitlementDays: number;
  date: Date;
  hijriDate?: string;
  notes?: string;
}

export class LeaveEntitlementsService {
  /**
   * Disburse annual leave entitlements to employee
   */
  async disburseLeaveEntitlements(
    companyId: string,
    userId: string,
    data: LeaveEntitlementsDisbursementData
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
        throw new Error('Employee not found');
      }

      const contract = employee.contracts[0];
      if (!contract) {
        throw new Error('Active contract not found for employee');
      }

      // Calculate new leave balance
      const currentBalance = Number(contract.leaveBalance || 0);
      const newBalance = currentBalance + data.entitlementDays;

      const updatedContract = await prisma.$transaction(async (tx) => {
        const contractRow = await tx.employeeContract.update({
          where: { id: contract.id },
          data: {
            leaveBalance: new Decimal(newBalance),
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
        await tx.employeeProcedure.create({
          data: {
            employeeId: data.employeeId,
            procedureType: 'leave_entitlement',
            date: data.date,
            description: `صرف مستحقات إجازة سنة ${data.year}: ${data.entitlementDays} يوم${data.notes ? `. ${data.notes}` : ''}`,
            createdBy: userId,
          },
        });
        return contractRow;
      });

      logger.info(
        {
          companyId,
          employeeId: data.employeeId,
          contractId: contract.id,
          year: data.year,
          entitlementDays: data.entitlementDays,
          newBalance,
        },
        'Leave entitlements disbursed'
      );

      return {
        contract: updatedContract,
        entitlementDays: data.entitlementDays,
        previousBalance: currentBalance,
        newBalance,
        year: data.year,
      };
    } catch (error) {
      logger.error(
        { error, companyId, data },
        'Error disbursing leave entitlements'
      );
      throw error;
    }
  }

  /**
   * Get leave entitlements history for an employee
   */
  async getLeaveEntitlementsHistory(
    companyId: string,
    employeeId: string,
    year?: string
  ) {
    try {
      const where: any = {
        employee: {
          id: employeeId,
          companyId,
        },
        procedureType: 'leave_entitlement',
      };

      if (year) {
        where.date = {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${parseInt(year) + 1}-01-01`),
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
        { error, companyId, employeeId, year },
        'Error getting leave entitlements history'
      );
      throw error;
    }
  }
}

export const leaveEntitlementsService = new LeaveEntitlementsService();

/**
 * Annual leave clearance (تصفية مستحقات الإجازة السنوية) — a settlement
 * document, not the canonical leave ledger (see HCM_LEAVE_CURRENT_STATE.md).
 * Records the clearance and accrues its value: Dr leave expense / Cr accrued
 * payroll. The cash payout is the annual-leave disbursement.
 */
export async function clearAnnualLeaveEntitlements(
  companyId: string,
  userId: string,
  data: AnnualLeaveClearanceInput
) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, companyId },
    select: { id: true, arabicName: true },
  });
  if (!employee) throw new AppError(404, 'الموظف غير موجود');

  const amount = Math.round(Number(data.amount) * 100) / 100;
  if (!(amount > 0)) throw new AppError(422, 'قيمة المستحقات يجب أن تكون أكبر من صفر');

  const date = new Date(data.date);
  const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, date);
  const accounts = await hrGlAccountResolverService.resolveAccounts(companyId);
  if (!accounts.accruedPayrollAccountId) {
    throw new AppError(422, 'حساب مستحقات الرواتب غير معرّف في إعدادات الموارد البشرية');
  }
  const expenseAccountId = data.accountId || accounts.salariesExpenseAccountId;
  const company = await prisma.companySettings.findUnique({ where: { companyId }, select: { defaultCurrency: true } });
  const year = String(data.year ?? date.getUTCFullYear());

  return prisma.$transaction(async (tx) => {
    // One clearance per employee per leave year. The lock MUST be the first
    // statement: MySQL REPEATABLE READ fixes the read snapshot at the first
    // plain read, so a read before the lock would hide a concurrent commit.
    await tx.$executeRaw`SELECT id FROM employees WHERE id = ${employee.id} FOR UPDATE`;

    const account = await tx.account.findFirst({ where: { id: expenseAccountId, companyId }, select: { id: true } });
    if (!account) throw new AppError(404, 'حساب المصروف غير موجود');

    const duplicate = await tx.employeeProcedure.findFirst({
      where: {
        employeeId: employee.id,
        employee: { companyId },
        procedureType: 'annual_leave_clearance',
        serial: `ALC-${year}`,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(409, `تمت تصفية مستحقات إجازة سنة ${year} لهذا الموظف من قبل`);
    }

    const procedure = await tx.employeeProcedure.create({
      data: {
        employeeId: employee.id,
        serial: `ALC-${year}`,
        procedureType: 'annual_leave_clearance',
        date,
        amount: new Decimal(amount),
        description: `تصفية مستحقات إجازة سنة ${year}: ${data.days ?? 0} يوم بقيمة ${amount}${data.notes ? `. ${data.notes}` : ''}`,
        createdBy: userId,
      },
    });

    const description = `تصفية مستحقات إجازة سنوية - ${employee.arabicName}`;
    const journal = await journalPostingService.createAndPostInTx(
      tx,
      { companyId, userId, fiscalYearId },
      {
        fiscalYearId,
        date,
        description,
        currencyCode: company?.defaultCurrency?.trim() || 'EGP',
        exchangeRate: 1,
        entryType: 'AnnualLeaveClearance',
        sourceType: 'HR-LV-CLR',
        sourceId: procedure.id,
        lines: journalLines([
          { accountId: expenseAccountId, debit: amount, credit: 0, description },
          { accountId: accounts.accruedPayrollAccountId, debit: 0, credit: amount, description },
        ]),
      }
    );

    logger.info({ companyId, employeeId: employee.id, amount, year }, 'Annual leave entitlements cleared');
    return { procedure, journalEntryId: journal.id, amount, year };
  });
}

