// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

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
        throw new Error('Employee not found');
      }

      const contract = employee.contracts[0];
      if (!contract) {
        throw new Error('Active contract not found for employee');
      }

      // Check if housing allowance already cleared for this period
      const existingProcedure = await prisma.employeeProcedure.findFirst({
        where: {
          employeeId: data.employeeId,
          employee: { companyId },
          procedureType: 'housing_allowance',
          date: {
            gte: new Date(`${data.periodYear}-${data.periodMonth}-01`),
            lt: (() => {
              const nextMonth = parseInt(data.periodMonth) + 1;
              const nextMonthStr = nextMonth > 12 
                ? `01` 
                : String(nextMonth).padStart(2, '0');
              const nextYear = nextMonth > 12 
                ? String(parseInt(data.periodYear) + 1) 
                : data.periodYear;
              return new Date(`${nextYear}-${nextMonthStr}-01`);
            })(),
          },
        },
      });

      if (existingProcedure) {
        throw new Error(
          'Housing allowance already cleared for this period'
        );
      }

      const procedure = await prisma.$transaction(async (tx) => {
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

        if (data.accountId) {
          const account = await tx.account.findFirst({
            where: { id: data.accountId, companyId },
          });

          if (!account) {
            throw new Error('Account not found');
          }

          await tx.journalEntry.create({
            data: {
              companyId,
              date: data.date,
              hijriDate: data.hijriDate,
              description: `Housing Allowance for employee ${employee.arabicName} - ${data.periodYear}-${data.periodMonth}`,
              currencyCode: 'SAR',
              isPosted: true,
              isApproved: true,
              createdBy: userId,
              lines: {
                create: [
                  {
                    accountId: data.accountId,
                    debit: new Decimal(data.allowanceAmount),
                    credit: new Decimal(0),
                    description: `Housing Allowance - ${employee.arabicName}`,
                  },
                ],
              },
            },
          });
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

