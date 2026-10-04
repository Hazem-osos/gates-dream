import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { applyPostedJournalBalancesInTx } from './ledger-balance.service';

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

export class AccountMovementService {
  /**
   * Move the selected journal lines onto another account.
   * Posted, unposted and cancelled lines are edited in place. No settlement journal.
   * Posted lines that still affect balances also move their period and card totals.
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

      if (toAccount.accountKind === 'HEADER') {
        throw new AppError(
          409,
          `لا يمكن نقل الحركة إلى «${toAccount.code} — ${toAccount.arabicName}» لأنه حساب رئيسي. اختَر حساب حركة.`
        );
      }

      if (data.fromAccountId === data.toAccountId) {
        throw new Error('From account and to account cannot be the same');
      }

      if (data.fromDate > data.toDate) {
        throw new Error('From date must be before or equal to to date');
      }

      const lineWhere: Prisma.JournalEntryLineWhereInput = {
        accountId: data.fromAccountId,
        ...(data.lineIds?.length ? { id: { in: data.lineIds } } : {}),
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
          throw new AppError(422, 'لا توجد قيود على هذا الحساب في الفترة المحددة');
        }

        await lockJournalEntriesInTx(
          tx,
          companyId,
          matchedLines.map((line) => line.journalEntryId)
        );

        const lines = await tx.journalEntryLine.findMany({
          where: {
            id: { in: matchedLines.map((line) => line.id) },
            accountId: data.fromAccountId,
            journalEntry: { companyId, deletedAt: null },
          },
          select: {
            id: true,
            debitBase: true,
            creditBase: true,
            journalEntryId: true,
            journalEntry: { select: { date: true, isPosted: true, postingStatus: true, isCancelled: true } },
          },
        });
        if (lines.length === 0) {
          throw new AppError(409, 'تم نقل هذه الحركات من عملية أخرى. حدّث القائمة ثم أعد المحاولة.');
        }

        const postedByPeriod = new Map<string, typeof lines>();
        for (const line of lines) {
          const posted = line.journalEntry.isPosted || line.journalEntry.postingStatus === 'Post';
          if (!posted || line.journalEntry.isCancelled) continue;
          const date = line.journalEntry.date;
          const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
          const group = postedByPeriod.get(key) ?? [];
          group.push(line);
          postedByPeriod.set(key, group);
        }
        for (const group of postedByPeriod.values()) {
          const deltas = (accountId: string) =>
            group.map((line) => ({
              accountId,
              debitBase: line.debitBase,
              creditBase: line.creditBase,
            }));
          const balanceMove = {
            companyId,
            date: group[0].journalEntry.date,
            currencyCode: 'EGP',
            skipPartnerBalances: true,
          };
          await applyPostedJournalBalancesInTx(tx, {
            ...balanceMove,
            lines: deltas(data.fromAccountId),
            invert: true,
          });
          await applyPostedJournalBalancesInTx(tx, {
            ...balanceMove,
            lines: deltas(data.toAccountId),
          });
        }

        const updated = await tx.journalEntryLine.updateMany({
          where: {
            id: { in: lines.map((line) => line.id) },
            accountId: data.fromAccountId,
          },
          data: { accountId: data.toAccountId },
        });

        return {
          journalEntryId: null,
          matchedLinesCount: updated.count,
          matchedJournalEntriesCount: new Set(lines.map((line) => line.journalEntryId)).size,
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
          matchedLinesCount: result.matchedLinesCount,
          userId,
        },
        'Account movement rewritten on the original journal lines'
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
          take: MOVEMENT_LIST_CAP + 1,
        }),
        prisma.journalEntryLine.aggregate({
          where: {
            accountId,
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
