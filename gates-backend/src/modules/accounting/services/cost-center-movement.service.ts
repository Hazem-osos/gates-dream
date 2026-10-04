import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

const MOVEMENT_LIST_CAP = 5000;

async function lockJournalEntriesInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  journalEntryIds: string[]
) {
  const ids = [...new Set(journalEntryIds)].sort();
  if (!ids.length) return;
  await tx.$queryRaw`
    SELECT id FROM journal_entries
    WHERE companyId = ${companyId} AND id IN (${Prisma.join(ids)})
    ORDER BY id
    FOR UPDATE
  `;
}

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

      const lineWhere: Prisma.JournalEntryLineWhereInput = {
        costCenterId: data.fromCostCenterId,
        ...(data.accountId ? { accountId: data.accountId } : {}),
        ...(data.movementIds?.length ? { id: { in: data.movementIds } } : {}),
        journalEntry: {
          companyId,
          deletedAt: null,
          date: { gte: data.fromDate, lte: data.toDate },
        },
      };

      const result = await prisma.$transaction(async (tx) => {
        const matchedLines = await tx.journalEntryLine.findMany({
          where: lineWhere,
          select: { id: true, journalEntryId: true },
        });
        if (matchedLines.length === 0) {
          throw new AppError(422, 'لا توجد قيود على مركز التكلفة هذا في الفترة المحددة');
        }

        await lockJournalEntriesInTx(
          tx,
          companyId,
          matchedLines.map((line) => line.journalEntryId)
        );

        const updated = await tx.journalEntryLine.updateMany({
          where: {
            id: { in: matchedLines.map((line) => line.id) },
            costCenterId: data.fromCostCenterId,
            journalEntry: { companyId, deletedAt: null },
          },
          data: { costCenterId: data.toCostCenterId },
        });
        if (updated.count === 0) {
          throw new AppError(409, 'تم نقل هذه الحركات من عملية أخرى. حدّث القائمة ثم أعد المحاولة.');
        }

        logger.info(
          {
            companyId,
            fromCostCenterId: data.fromCostCenterId,
            toCostCenterId: data.toCostCenterId,
            dateRange: { from: data.fromDate, to: data.toDate },
            movementsUpdated: updated.count,
            userId,
          },
          'Cost center movement rewritten on the original journal lines'
        );

        return {
          movementsTransferredCount: updated.count,
          journalEntryId: null,
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

      const [periodLines, allTime] = await Promise.all([
        prisma.journalEntryLine.findMany({
          where: {
            costCenterId,
            ...(accountId ? { accountId } : {}),
            journalEntry: {
              companyId,
              deletedAt: null,
              date: { gte: fromDate, lte: toDate },
            },
          },
          select: {
            id: true,
            debitBase: true,
            creditBase: true,
            description: true,
            journalEntry: {
              select: {
                id: true,
                date: true,
                voucherNumber: true,
                legacyGlNum: true,
                description: true,
                isPosted: true,
                isCancelled: true,
              },
            },
          },
          orderBy: { journalEntry: { date: 'asc' } },
          take: MOVEMENT_LIST_CAP + 1,
        }),
        prisma.journalEntryLine.aggregate({
          where: {
            costCenterId,
            journalEntry: {
              companyId,
              deletedAt: null,
            },
          },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

      if (periodLines.length > MOVEMENT_LIST_CAP) {
        throw new AppError(422, 'حركات الفترة أكتر من ٥٠٠٠ سطر. ضيّق الفترة ثم حمّل تاني.');
      }

      const totalDebit = periodLines.reduce((sum, line) => sum + Number(line.debitBase), 0);
      const totalCredit = periodLines.reduce((sum, line) => sum + Number(line.creditBase), 0);
      const currentBalance =
        Number(allTime._sum.debitBase ?? 0) - Number(allTime._sum.creditBase ?? 0);

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
          movementsCount: periodLines.length,
        },
        movements: periodLines.map((line) => ({
          id: line.id,
          journalEntryId: line.journalEntry.id,
          documentNumber:
            line.journalEntry.voucherNumber ||
            line.journalEntry.legacyGlNum ||
            line.id.slice(0, 8),
          date: line.journalEntry.date,
          description: line.description || line.journalEntry.description || '',
          debit: Number(line.debitBase),
          credit: Number(line.creditBase),
          isPosted: line.journalEntry.isPosted,
          isCancelled: line.journalEntry.isCancelled,
          statusLabel: line.journalEntry.isCancelled
            ? 'ملغي'
            : line.journalEntry.isPosted
              ? 'مرحل'
              : 'غير مرحل',
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
