import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import type { JournalEntryLineData } from '../types/journal-entry.types';

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

      if (toCostCenter.costCenterKind === 'HEADER') {
        throw new AppError(
          409,
          `لا يمكن نقل الحركة إلى «${toCostCenter.code} — ${toCostCenter.arabicName}» لأنه رئيسي/رئيسي فرعي. اختَر مركز حركة.`
        );
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

        const postedLines = await tx.journalEntryLine.findMany({
          where: {
            costCenterId: data.fromCostCenterId,
            ...(data.accountId ? { accountId: data.accountId } : {}),
            journalEntry: {
              companyId,
              isPosted: true,
              isCancelled: false,
              deletedAt: null,
              date: { gte: data.fromDate, lte: data.toDate },
            },
          },
          select: {
            accountId: true,
            debitBase: true,
            creditBase: true,
          },
        });

        if (movements.length === 0 && postedLines.length === 0) {
          throw new Error(
            'No cost center movements found for the specified criteria and date range'
          );
        }

        const netByAccount = new Map<string, number>();
        for (const line of postedLines) {
          netByAccount.set(
            line.accountId,
            roundTo4(
              (netByAccount.get(line.accountId) ?? 0) +
                Number(line.debitBase) -
                Number(line.creditBase)
            )
          );
        }

        let journalEntryId: string | null = null;
        const reclassLines: JournalEntryLineData[] = [];
        for (const [accountId, net] of netByAccount.entries()) {
          if (Math.abs(net) < 0.0001) continue;
          const amount = Math.abs(net);
          if (net > 0) {
            reclassLines.push(
              {
                accountId,
                debit: amount,
                credit: 0,
                lineOrder: reclassLines.length + 1,
                costCenterId: data.toCostCenterId,
                description: data.description,
              },
              {
                accountId,
                debit: 0,
                credit: amount,
                lineOrder: reclassLines.length + 2,
                costCenterId: data.fromCostCenterId,
                description: data.description,
              }
            );
          } else {
            reclassLines.push(
              {
                accountId,
                debit: amount,
                credit: 0,
                lineOrder: reclassLines.length + 1,
                costCenterId: data.fromCostCenterId,
                description: data.description,
              },
              {
                accountId,
                debit: 0,
                credit: amount,
                lineOrder: reclassLines.length + 2,
                costCenterId: data.toCostCenterId,
                description: data.description,
              }
            );
          }
        }

        if (reclassLines.length > 0) {
          const branchId = (
            await tx.branch.findFirst({
              where: { companyId, deletedAt: null },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
          )?.id;
          if (!branchId) {
            throw new AppError(422, 'لا يوجد فرع لترحيل قيد نقل مركز التكلفة');
          }
          const reclassDate = new Date();
          const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, reclassDate);
          const description =
            data.description ??
            `نقل مركز تكلفة: ${fromCostCenter.code} → ${toCostCenter.code}`;
          const je = await journalPostingService.createAndPostInTx(
            tx,
            { companyId, branchId, userId, fiscalYearId },
            {
              date: reclassDate,
              hijriDate: data.hijriDate,
              description,
              currencyCode: 'EGP',
              exchangeRate: 1,
              fiscalYearId,
              entryType: 'RECLASSIFICATION',
              lines: reclassLines.map((line, index) => ({
                ...line,
                lineOrder: index + 1,
                description: line.description ?? description,
              })),
            }
          );
          journalEntryId = je.id;
          await tx.costCenterMovement.createMany({
            data: reclassLines.map((line) => ({
              companyId,
              accountId: line.accountId,
              costCenterId: line.costCenterId!,
              date: reclassDate,
              debit: new Decimal(line.debit),
              credit: new Decimal(line.credit),
              description: line.description ?? description,
            })),
          });
        }

        const updatedMovements =
          reclassLines.length === 0 && movements.length > 0
            ? await tx.costCenterMovement.updateMany({
                where: { id: { in: movements.map((m) => m.id) } },
                data: {
                  costCenterId: data.toCostCenterId,
                  ...(data.description && { description: data.description }),
                },
              })
            : { count: reclassLines.length };

        logger.info(
          {
            companyId,
            fromCostCenterId: data.fromCostCenterId,
            toCostCenterId: data.toCostCenterId,
            dateRange: { from: data.fromDate, to: data.toDate },
            movementsUpdated: updatedMovements.count,
            journalEntryId,
            userId,
          },
          'Cost center movement transferred'
        );

        return {
          movementsTransferredCount: updatedMovements.count + (journalEntryId ? 1 : 0),
          journalEntryId,
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
