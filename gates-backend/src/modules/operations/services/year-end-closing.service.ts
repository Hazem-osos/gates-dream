import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { financialReportService } from '../../accounting/services/financial-report.service';
import { classifyAccount } from '../../accounting/services/financial-report.util';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';

export class YearEndClosingService {
  private async resolveRetainedEarningsAccountId(companyId: string): Promise<string> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
    });
    if (settings?.retainedEarningsAccountId) {
      return settings.retainedEarningsAccountId;
    }
    const fallback = await prisma.account.findFirst({
      where: { companyId, code: '3900', deletedAt: null },
    });
    if (!fallback) {
      throw new AppError(
        422,
        'Configure company_settings.retainedEarningsAccountId or account 3900'
      );
    }
    return fallback.id;
  }

  async validateBeforeClose(companyId: string, fiscalYearId: string) {
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!year) throw new AppError(404, 'Fiscal year not found');
    if (year.status === 'Close') throw new AppError(400, 'Fiscal year is already closed');

    // Legacy `untYear.pas dxButton2Click` (message 1911): every earlier fiscal year
    // (by ToDate/endDate) must already be closed before this one can close — years
    // close in strict chronological order, mirroring `reopenFiscalYear`'s symmetric
    // "later year must reopen first" rule below.
    const earlierOpenYear = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        status: { not: 'Close' },
        endDate: { lt: year.endDate },
      },
      orderBy: { endDate: 'desc' },
    });
    if (earlierOpenYear) {
      throw new AppError(
        422,
        `يجب إغلاق السنة السابقة أولا (${earlierOpenYear.legacyYearId})` // LangMessages 1911
      );
    }

    const unpostedJe = await prisma.journalEntry.count({
      where: {
        companyId,
        fiscalYearId,
        isCancelled: false,
        deletedAt: null,
        OR: [{ isPosted: false }, { postingStatus: 'UnPost' }],
      },
    });
    if (unpostedJe > 0) {
      throw new AppError(422, `${unpostedJe} journal entries are not posted in this fiscal year`);
    }

    const unpostedInv = await prisma.invoice.count({
      where: {
        companyId,
        fiscalYearId,
        isCancelled: false,
        isPosted: false,
      },
    });
    if (unpostedInv > 0) {
      throw new AppError(422, `${unpostedInv} invoices are not posted in this fiscal year`);
    }

    const unpostedCash = await prisma.cashTransaction.count({
      where: {
        companyId,
        fiscalYearId,
        isCancelled: false,
        isPosted: false,
      },
    });
    if (unpostedCash > 0) {
      throw new AppError(
        422,
        `${unpostedCash} cash transactions are not posted in this fiscal year`
      );
    }

    const tb = await financialReportService.getTrialBalance({
      companyId,
      fiscalYearId,
      startDate: year.startDate,
      endDate: year.endDate,
    });
    if (!tb.verification.balanced) {
      throw new AppError(422, 'Trial balance is not balanced for the fiscal year');
    }

    return year;
  }

  async closeFiscalYear(ctx: JournalPostingContext, fiscalYearId: string) {
    // Legacy `AdvancedRights.YearClose` (message 1908) — per-user, not company-wide.
    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      'yearClose',
      { isAdmin: ctx.isAdmin, actionLabel: 'close the fiscal year' }
    );
    const year = await this.validateBeforeClose(ctx.companyId, fiscalYearId);
    const retainedEarningsAccountId = await this.resolveRetainedEarningsAccountId(ctx.companyId);

    type Row = {
      accountId: string;
      code: string;
      accountType: string | null;
      debitSum: unknown;
      creditSum: unknown;
    };

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        a.id AS accountId,
        a.code,
        a.accountType,
        COALESCE(SUM(jel.debitBase), 0) AS debitSum,
        COALESCE(SUM(jel.creditBase), 0) AS creditSum
      FROM accounts a
      INNER JOIN journal_entry_lines jel ON jel.accountId = a.id
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE a.companyId = ${ctx.companyId}
        AND a.deletedAt IS NULL
        AND je.fiscalYearId = ${fiscalYearId}
        AND je.isPosted = true
        AND je.isCancelled = false
        AND je.deletedAt IS NULL
      GROUP BY a.id, a.code, a.accountType
    `);

    const closeLines: Array<{ accountId: string; debit: number; credit: number }> = [];
    let netToRetained = 0;

    for (const row of rows) {
      const cls = classifyAccount(row.code, row.accountType);
      if (!['REVENUE', 'COGS', 'EXPENSE'].includes(cls)) continue;

      const debit = roundTo4(Number(row.debitSum));
      const credit = roundTo4(Number(row.creditSum));
      const balance = roundTo4(debit - credit);

      if (cls === 'REVENUE') {
        const revBalance = roundTo4(credit - debit);
        if (revBalance === 0) continue;
        closeLines.push({
          accountId: row.accountId,
          debit: revBalance > 0 ? revBalance : 0,
          credit: revBalance < 0 ? -revBalance : 0,
        });
        netToRetained = roundTo4(netToRetained + revBalance);
      } else if (balance !== 0) {
        closeLines.push({
          accountId: row.accountId,
          debit: balance < 0 ? -balance : 0,
          credit: balance > 0 ? balance : 0,
        });
        netToRetained = roundTo4(netToRetained - balance);
      }
    }

    if (closeLines.length === 0) {
      throw new AppError(422, 'No P&L balances to close for this fiscal year');
    }

    if (netToRetained > 0) {
      closeLines.push({
        accountId: retainedEarningsAccountId,
        debit: 0,
        credit: netToRetained,
      });
    } else if (netToRetained < 0) {
      closeLines.push({
        accountId: retainedEarningsAccountId,
        debit: roundTo4(-netToRetained),
        credit: 0,
      });
    }

    const pl = await financialReportService.getIncomeStatement({
      companyId: ctx.companyId,
      fiscalYearId,
      startDate: year.startDate,
      endDate: year.endDate,
    });

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId,
        date: year.endDate,
        description: `Year-end close ${year.legacyYearId}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'YearClose',
        sourceType: 'YC',
        sourceNumber: year.legacyYearId,
        lines: journalLines(closeLines),
      });

      await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: {
          status: 'Close',
          closedAt: new Date(),
          closedBy: ctx.userId,
          closingJournalEntryId: je.id,
        },
      });

      return {
        fiscalYearId,
        closingJournalEntryId: je.id,
        netProfit: pl.netProfit,
        retainedEarningsTransfer: netToRetained,
        closedAt: new Date(),
      };
    });
  }

  /**
   * Wave 2 fix: reverses a year-end close — dated contra entry against the
   * closing JE and reopens the fiscal year. Blocked if a later fiscal year
   * is already closed, since that would leave the closed sequence with a
   * hole (later year's opening balances would silently become wrong).
   */
  async reopenFiscalYear(ctx: JournalPostingContext, fiscalYearId: string) {
    // Legacy `AdvancedRights.YearOpen` (message 1918) — per-user, not company-wide.
    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      'yearOpen',
      { isAdmin: ctx.isAdmin, actionLabel: 'reopen the fiscal year' }
    );
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId: ctx.companyId },
    });
    if (!year) throw new AppError(404, 'Fiscal year not found');
    if (year.status !== 'Close') {
      throw new AppError(400, 'Fiscal year is not closed');
    }
    if (!year.closingJournalEntryId) {
      throw new AppError(400, 'Fiscal year has no closing journal entry to reverse');
    }

    const laterClosedYear = await prisma.fiscalYear.findFirst({
      where: {
        companyId: ctx.companyId,
        status: 'Close',
        startDate: { gt: year.startDate },
      },
    });
    if (laterClosedYear) {
      throw new AppError(
        400,
        `Cannot reopen: fiscal year starting ${laterClosedYear.startDate.toISOString().slice(0, 10)} is already closed. Reopen later years first.`
      );
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, year.closingJournalEntryId!, {
        date: year.endDate,
        reason: 'Year-end close reopened',
      });

      return tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: {
          status: 'Open',
          closedAt: null,
          closedBy: null,
          closingJournalEntryId: null,
        },
      });
    });
  }

  async assertFiscalYearOpenForMutation(companyId: string, fiscalYearId: string | null | undefined) {
    if (!fiscalYearId) return;
    await fiscalYearService.assertOpenById(companyId, fiscalYearId);
  }
}

export const yearEndClosingService = new YearEndClosingService();
