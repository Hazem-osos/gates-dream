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
        const matchedLines = await tx.journalEntryLine.findMany({
          where: {
            costCenterId: data.fromCostCenterId,
            ...(data.accountId ? { accountId: data.accountId } : {}),
            ...(data.movementIds?.length ? { id: { in: data.movementIds } } : {}),
            journalEntry: {
              companyId,
              deletedAt: null,
              date: { gte: data.fromDate, lte: data.toDate },
            },
          },
          select: {
            id: true,
            accountId: true,
            debitBase: true,
            creditBase: true,
            journalEntry: { select: { isPosted: true, isCancelled: true } },
          },
        });

        if (matchedLines.length === 0) {
          throw new Error(
            'No cost center movements found for the specified criteria and date range'
          );
        }

        const postedLines = matchedLines.filter(
          (line) => line.journalEntry.isPosted && !line.journalEntry.isCancelled
        );
        const movableLineIds = matchedLines
          .filter((line) => !line.journalEntry.isPosted || line.journalEntry.isCancelled)
          .map((line) => line.id);

        if (movableLineIds.length > 0) {
          await tx.journalEntryLine.updateMany({
            where: { id: { in: movableLineIds } },
            data: { costCenterId: data.toCostCenterId },
          });
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

        if (reclassLines.length === 0 && movableLineIds.length === 0) {
          throw new AppError(422, 'صافي حركة الفترة صفر — لا يوجد ما يُنقل');
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
          const companySettings = await tx.companySettings.findUnique({
            where: { companyId },
            select: { defaultCurrency: true },
          });
          const baseCurrency = (companySettings?.defaultCurrency || 'EGP').toUpperCase();
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
              currencyCode: baseCurrency,
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

        logger.info(
          {
            companyId,
            fromCostCenterId: data.fromCostCenterId,
            toCostCenterId: data.toCostCenterId,
            dateRange: { from: data.fromDate, to: data.toDate },
            movementsUpdated: matchedLines.length,
            journalEntryId,
            userId,
          },
          'Cost center movement transferred'
        );

        return {
          movementsTransferredCount: matchedLines.length,
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

      const [periodLines, allTime] = await Promise.all([
        prisma.journalEntryLine.findMany({
          where: {
            costCenterId,
            ...(accountId ? { accountId } : {}),
            journalEntry: {
              companyId,
              deletedAt: null,
              date: { gte: fromDate, lte: toDate },
              reversalOfJournalEntryId: null,
              NOT: { entryType: 'REVERSAL' },
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
          take: 500,
        }),
        prisma.journalEntryLine.aggregate({
          where: {
            costCenterId,
            journalEntry: {
              companyId,
              deletedAt: null,
              reversalOfJournalEntryId: null,
              NOT: { entryType: 'REVERSAL' },
            },
          },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

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
