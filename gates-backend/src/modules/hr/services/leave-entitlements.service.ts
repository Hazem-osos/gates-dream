import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

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

      // Update contract leave balance
      const updatedContract = await prisma.employeeContract.update({
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

      // Create employee procedure record
      await prisma.employeeProcedure.create({
        data: {
          employeeId: data.employeeId,
          procedureType: 'leave_entitlement',
          date: data.date,
          description: `Annual leave entitlement disbursement for year ${data.year}: ${data.entitlementDays} days${data.notes ? `. Notes: ${data.notes}` : ''}`,
          createdBy: userId,
        },
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

