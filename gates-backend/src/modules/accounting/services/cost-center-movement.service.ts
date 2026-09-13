import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface TransferCostCenterMovementData {
  fromCostCenterId: string;
  toCostCenterId: string;
  fromDate: Date;
  toDate: Date;
  accountId?: string; // Optional: filter by specific account
  hijriDate?: string;
  description?: string;
  movementIds?: string[];
}

export class CostCenterMovementService {
  /**
   * Transfer cost center movements from one cost center to another
   */
  async transferCostCenterMovement(
    companyId: string,
    userId: string,
    data: TransferCostCenterMovementData
  ) {
    try {
      // Verify both cost centers belong to company
      const fromCostCenter = await prisma.costCenter.findFirst({
        where: { id: data.fromCostCenterId, companyId },
      });

      if (!fromCostCenter) {
        throw new Error('From cost center not found');
      }

      const toCostCenter = await prisma.costCenter.findFirst({
        where: { id: data.toCostCenterId, companyId },
      });

      if (!toCostCenter) {
        throw new Error('To cost center not found');
      }

      if (data.fromCostCenterId === data.toCostCenterId) {
        throw new Error(
          'From cost center and to cost center cannot be the same'
        );
      }

      // Validate date range
      if (data.fromDate > data.toDate) {
        throw new Error('From date must be before or equal to to date');
      }

      // If accountId is provided, verify it belongs to company
      if (data.accountId) {
        const account = await prisma.account.findFirst({
          where: { id: data.accountId, companyId },
        });

        if (!account) {
          throw new Error('Account not found');
        }
      }

      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Build where clause for cost center movements
        const where: any = {
          companyId,
          costCenterId: data.fromCostCenterId,
          date: {
            gte: data.fromDate,
            lte: data.toDate,
          },
        };

        if (data.accountId) {
          where.accountId = data.accountId;
        }

        // Find all cost center movements in the date range
        const movements = await tx.costCenterMovement.findMany({
          where: {
            ...where,
            ...(data.movementIds?.length ? { id: { in: data.movementIds } } : {}),
          },
        });

        if (movements.length === 0) {
          throw new Error(
            'No cost center movements found for the specified criteria and date range'
          );
        }

        // Update all movements to point to the new cost center
        const updatedMovements = await tx.costCenterMovement.updateMany({
          where: {
            id: {
              in: movements.map((m) => m.id),
            },
          },
          data: {
            costCenterId: data.toCostCenterId,
            ...(data.description && { description: data.description }),
          },
        });

        // Posted journal lines are immutable (C9). Operational cost-center
        // movement rows may move; GL history is not rewritten in place.

        logger.info(
          {
            companyId,
            fromCostCenterId: data.fromCostCenterId,
            toCostCenterId: data.toCostCenterId,
            dateRange: { from: data.fromDate, to: data.toDate },
            movementsUpdated: updatedMovements.count,
            userId,
          },
          'Cost center movement transferred'
        );

        return {
          movementsTransferredCount: updatedMovements.count,
          fromCostCenter: {
            id: fromCostCenter.id,
            code: fromCostCenter.code,
            arabicName: fromCostCenter.arabicName,
          },
          toCostCenter: {
            id: toCostCenter.id,
            code: toCostCenter.code,
            arabicName: toCostCenter.arabicName,
          },
        };
      });

      return result;
    } catch (error) {
      logger.error(
        { error, companyId, userId, data },
        'Error transferring cost center movement'
      );
      throw error;
    }
  }

  /**
   * Get cost center movement summary (for reporting)
   */
  async getCostCenterMovementSummary(
    companyId: string,
    costCenterId: string,
    fromDate: Date,
    toDate: Date,
    accountId?: string
  ) {
    try {
      const costCenter = await prisma.costCenter.findFirst({
        where: { id: costCenterId, companyId },
      });

      if (!costCenter) {
        throw new Error('Cost center not found');
      }

      const where: any = {
        companyId,
        costCenterId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      };

      if (accountId) {
        where.accountId = accountId;
      }

      const [movements, allTime] = await Promise.all([
        prisma.costCenterMovement.findMany({
          where,
          include: {
            account: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
          orderBy: { date: 'asc' },
          take: 500,
        }),
        prisma.costCenterMovement.aggregate({
          where: { companyId, costCenterId },
          _sum: { debit: true, credit: true },
        }),
      ]);

      const totalDebit = movements.reduce((sum, m) => sum + Number(m.debit), 0);
      const totalCredit = movements.reduce((sum, m) => sum + Number(m.credit), 0);
      const currentBalance =
        Number(allTime._sum.debit ?? 0) - Number(allTime._sum.credit ?? 0);

      return {
        costCenter: {
          id: costCenter.id,
          code: costCenter.code,
          arabicName: costCenter.arabicName,
        },
        dateRange: {
          from: fromDate,
          to: toDate,
        },
        currentBalance,
        summary: {
          totalDebit,
          totalCredit,
          balance: totalDebit - totalCredit,
          movementsCount: movements.length,
        },
        movements: movements.map((m) => ({
          id: m.id,
          journalEntryId: null,
          documentNumber: m.account?.code || m.id.slice(0, 8),
          date: m.date,
          description: m.description || m.account?.arabicName || '',
          debit: Number(m.debit),
          credit: Number(m.credit),
        })),
      };
    } catch (error) {
      logger.error(
        { error, companyId, costCenterId, fromDate, toDate, accountId },
        'Error getting cost center movement summary'
      );
      throw error;
    }
  }
}

export const costCenterMovementService = new CostCenterMovementService();
