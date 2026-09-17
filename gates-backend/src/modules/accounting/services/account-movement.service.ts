import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import type { JournalEntryLineData } from '../types/journal-entry.types';

export interface TransferAccountMovementData {
  fromAccountId: string;
  toAccountId: string;
  fromDate: Date;
  toDate: Date;
  hijriDate?: string;
  description?: string;
  branchId?: string;
  lineIds?: string[];
}

export class AccountMovementService {
  /**
   * C9 fix — reclassify a posted account balance from one account to
   * another. Previously this rewrote every matching `journalEntryLine.accountId`
   * in place, silently changing already-issued trial balances/financial
   * statements with no audit trail. Posted ledger lines are immutable
   * accounting facts, so this now posts a single dated reclassification
   * journal entry (debit the new account, credit the old one, or the
   * reverse, for the *net* posted balance in range) instead of touching
   * any historical row.
   */
  async transferAccountMovement(
    companyId: string,
    userId: string,
    data: TransferAccountMovementData
  ) {
    try {
      const fromAccount = await prisma.account.findFirst({
        where: { id: data.fromAccountId, companyId },
      });
      if (!fromAccount) {
        throw new Error('From account not found');
      }

      const toAccount = await prisma.account.findFirst({
        where: { id: data.toAccountId, companyId },
      });
      if (!toAccount) {
        throw new Error('To account not found');
      }

      if (data.fromAccountId === data.toAccountId) {
        throw new Error('From account and to account cannot be the same');
      }

      if (data.fromDate > data.toDate) {
        throw new Error('From date must be before or equal to to date');
      }

      const branchId =
        data.branchId ??
        (
          await prisma.branch.findFirst({
            where: { companyId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        )?.id;
      if (!branchId) {
        throw new AppError(422, 'Company has no branch to post the reclassification journal against');
      }

      const matchedLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: data.fromAccountId,
          ...(data.lineIds?.length ? { id: { in: data.lineIds } } : {}),
          journalEntry: {
            companyId,
            deletedAt: null,
            date: { gte: data.fromDate, lte: data.toDate },
          },
        },
        select: {
          id: true,
          debitBase: true,
          creditBase: true,
          journalEntryId: true,
          journalEntry: { select: { isPosted: true, isCancelled: true } },
        },
      });

      if (matchedLines.length === 0) {
        throw new Error(
          'No journal entries found for the specified account and date range'
        );
      }

      const livePostedLines = matchedLines.filter(
        (line) => line.journalEntry.isPosted && !line.journalEntry.isCancelled
      );
      const movableLineIds = matchedLines
        .filter((line) => !line.journalEntry.isPosted || line.journalEntry.isCancelled)
        .map((line) => line.id);

      // Wave 2 fix: sum debitBase/creditBase (always EGP), not the raw
      // transaction-currency debit/credit — mixing lines posted in different
      // foreign currencies by their face amounts would produce a meaningless
      // net balance. The reclassification JE itself is always base-currency.
      const netDebit = roundTo4(
        livePostedLines.reduce((sum, l) => sum + Number(l.debitBase) - Number(l.creditBase), 0)
      );

      if (Math.abs(netDebit) < 0.0001 && movableLineIds.length === 0) {
        throw new AppError(
          422,
          'Net posted balance for this account in the date range is zero — nothing to reclassify'
        );
      }

      const needsReclass = Math.abs(netDebit) >= 0.0001;
      const reclassDate = new Date();
      const fiscalYearId = needsReclass
        ? await fiscalYearService.assertOpenForDate(companyId, reclassDate)
        : undefined;
      const companySettings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: { defaultCurrency: true },
      });
      const baseCurrency = (companySettings?.defaultCurrency || 'EGP').toUpperCase();

      const description =
        data.description ??
        `Reclassification: ${fromAccount.code} → ${toAccount.code} (${data.fromDate.toISOString().slice(0, 10)}..${data.toDate.toISOString().slice(0, 10)})`;

      const lines: JournalEntryLineData[] =
        netDebit > 0
          ? [
              { accountId: data.toAccountId, debit: netDebit, credit: 0, lineOrder: 1, description },
              { accountId: data.fromAccountId, debit: 0, credit: netDebit, lineOrder: 2, description },
            ]
          : [
              { accountId: data.fromAccountId, debit: -netDebit, credit: 0, lineOrder: 1, description },
              { accountId: data.toAccountId, debit: 0, credit: -netDebit, lineOrder: 2, description },
            ];

      const result = await prisma.$transaction(async (tx) => {
        if (movableLineIds.length > 0) {
          await tx.journalEntryLine.updateMany({
            where: { id: { in: movableLineIds } },
            data: { accountId: data.toAccountId },
          });
        }

        const je =
          needsReclass && fiscalYearId
            ? await journalPostingService.createAndPostInTx(
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
                  lines,
                }
              )
            : null;

        return {
          journalEntryId: je?.id ?? null,
          reclassifiedAmount: Math.abs(netDebit),
          direction: netDebit > 0 ? ('debit' as const) : ('credit' as const),
          matchedLinesCount: matchedLines.length,
          matchedJournalEntriesCount: new Set(matchedLines.map((l) => l.journalEntryId)).size,
          fromAccount: {
            id: fromAccount.id,
            code: fromAccount.code,
            arabicName: fromAccount.arabicName,
          },
          toAccount: {
            id: toAccount.id,
            code: toAccount.code,
            arabicName: toAccount.arabicName,
          },
        };
      });

      logger.info(
        {
          companyId,
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          dateRange: { from: data.fromDate, to: data.toDate },
          journalEntryId: result.journalEntryId,
          reclassifiedAmount: result.reclassifiedAmount,
          userId,
        },
        'Account movement reclassified via contra journal entry'
      );

      return result;
    } catch (error) {
      logger.error(
        { error, companyId, userId, data },
        'Error transferring account movement'
      );
      throw error;
    }
  }

  /**
   * Get account movement summary (for reporting)
   */
  async getAccountMovementSummary(
    companyId: string,
    accountId: string,
    fromDate: Date,
    toDate: Date
  ) {
    try {
      const account = await prisma.account.findFirst({
        where: { id: accountId, companyId },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const [periodLines, allTime] = await Promise.all([
        prisma.journalEntryLine.findMany({
          where: {
            accountId,
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
            debit: true,
            credit: true,
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
            accountId,
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
        account: {
          id: account.id,
          code: account.code,
          arabicName: account.arabicName,
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
          entriesCount: new Set(periodLines.map((line) => line.journalEntry.id)).size,
        },
        movements: periodLines.map((line) => ({
          id: line.id,
          journalEntryId: line.journalEntry.id,
          documentNumber: line.journalEntry.voucherNumber || line.journalEntry.legacyGlNum || line.journalEntry.id.slice(0, 8),
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
        { error, companyId, accountId, fromDate, toDate },
        'Error getting account movement summary'
      );
      throw error;
    }
  }
}

export const accountMovementService = new AccountMovementService();
