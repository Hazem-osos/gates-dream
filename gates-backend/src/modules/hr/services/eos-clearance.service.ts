// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

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
        throw new Error('Employee not found');
      }

      const contract = employee.contracts[0];
      if (!contract) {
        throw new Error('Active contract not found for employee');
      }

      // Calculate years of service
      const startDate = contract.contractStartDate;
      const endDate = data.clearanceDate;
      const yearsOfService =
        (endDate.getTime() - startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);

      const procedure = await prisma.$transaction(async (tx) => {
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
              date: data.clearanceDate,
              hijriDate: data.hijriDate,
              description: `EOS Clearance for employee ${employee.arabicName}`,
              currencyCode: 'SAR',
              isPosted: true,
              isApproved: true,
              createdBy: userId,
              lines: {
                create: [
                  {
                    accountId: data.accountId,
                    debit: new Decimal(data.eosAmount),
                    credit: new Decimal(0),
                    description: `EOS Payment - ${employee.arabicName}`,
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

