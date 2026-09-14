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
        'حساب الأرباح والخسائر غير مضبوط. حدّده من إعدادات الحسابات (أرباح محتجزة / أرباح وخسائر) ثم أعد الإغلاق.'
      );
    }
    return fallback.id;
  }

  async validateBeforeClose(companyId: string, fiscalYearId: string) {
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!year) throw new AppError(404, 'Fiscal year not found');
    if (year.status === 'Close') throw new AppError(400, 'السنة المالية مغلقة بالفعل');

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
        `يجب إغلاق السنة السابقة أولاً (${earlierOpenYear.arabicName || earlierOpenYear.legacyYearId}) ثم أعد المحاولة.`
      );
    }

    const blockers = await this.collectCloseBlockers(companyId, fiscalYearId, year.startDate, year.endDate);
    if (blockers.length > 0) {
      throw new AppError(422, blockers.join(' — '));
    }

    const tb = await financialReportService.getTrialBalance({
      companyId,
      fiscalYearId,
      startDate: year.startDate,
      endDate: year.endDate,
    });
    if (!tb.verification.balanced) {
      throw new AppError(
        422,
        'ميزان المراجعة غير متزن لهذه السنة. راجع القيود غير المتوازنة أو الحركات الناقصة ثم أعد الإغلاق.'
      );
    }

    return year;
  }

  /**
   * Year-end close gates the user asked for, in Arabic, with the next action.
   * Returned in order so the first line is the highest-priority blocker.
   */
  async collectCloseBlockers(
    companyId: string,
    fiscalYearId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    const dateRange = { gte: startDate, lte: endDate };
    const blockers: string[] = [];

    const negativeBalances = await prisma.itemWarehouseBalance.findMany({
      where: { companyId, quantityOnHand: { lt: 0 } },
      select: {
        quantityOnHand: true,
        warehouse: { select: { arabicName: true, code: true } },
        item: { select: { arabicName: true, serial: true } },
      },
      take: 6,
    });
    if (negativeBalances.length > 0) {
      const samples = negativeBalances
        .map((row) => {
          const warehouse = row.warehouse.arabicName || row.warehouse.code || 'مخزن';
          const item = row.item.arabicName || row.item.serial || 'صنف';
          return `«${warehouse}» / «${item}» (${Number(row.quantityOnHand)})`;
        })
        .join('، ');
      blockers.push(
        `يوجد مخزن برصيد سالب (${samples}). سوِّ الجرد أو أصلح حركات المخزون حتى لا يبقى رصيد سالب ثم أعد الإغلاق.`
      );
    }

    const [draftJe, draftInv] = await Promise.all([
      prisma.journalEntry.count({
        where: {
          companyId,
          fiscalYearId,
          isCancelled: false,
          deletedAt: null,
          isPosted: false,
          workflowStatus: 'DRAFT',
        },
      }),
      prisma.invoice.count({
        where: {
          companyId,
          fiscalYearId,
          isCancelled: false,
          isPosted: false,
          workflowStatus: 'DRAFT',
        },
      }),
    ]);
    if (draftJe + draftInv > 0) {
      const parts = [
        draftInv > 0 ? `${draftInv} فاتورة مسودة` : null,
        draftJe > 0 ? `${draftJe} قيد مسودة` : null,
      ].filter(Boolean);
      blockers.push(
        `يوجد ${parts.join(' و')} لم تُحذف ولم تُرحَّل. احذف المسودات أو رحّلها من شاشاتها ثم أعد الإغلاق.`
      );
    }

    const [unpostedJe, unpostedInv, unpostedCash] = await Promise.all([
      prisma.journalEntry.count({
        where: {
          companyId,
          fiscalYearId,
          isCancelled: false,
          deletedAt: null,
          workflowStatus: { not: 'DRAFT' },
          OR: [{ isPosted: false }, { postingStatus: 'UnPost' }],
        },
      }),
      prisma.invoice.count({
        where: {
          companyId,
          fiscalYearId,
          isCancelled: false,
          isPosted: false,
          workflowStatus: { not: 'DRAFT' },
        },
      }),
      prisma.cashTransaction.count({
        where: {
          companyId,
          fiscalYearId,
          isCancelled: false,
          isPosted: false,
          date: dateRange,
        },
      }),
    ]);
    if (unpostedJe + unpostedInv + unpostedCash > 0) {
      const parts = [
        unpostedInv > 0 ? `${unpostedInv} فاتورة` : null,
        unpostedJe > 0 ? `${unpostedJe} قيد` : null,
        unpostedCash > 0 ? `${unpostedCash} حركة خزينة` : null,
      ].filter(Boolean);
      blockers.push(
        `يوجد ${parts.join(' و')} غير مرحلة. رحّلها من شاشاتها أو احذفها إن كانت غير لازمة ثم أعد الإغلاق.`
      );
    }

    return blockers;
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
      const closed = await prisma.fiscalYear.update({
        where: { id: fiscalYearId },
        data: {
          status: 'Close',
          closedAt: new Date(),
          closedBy: ctx.userId,
          closingJournalEntryId: null,
        },
      });
      return {
        fiscalYearId,
        closingJournalEntryId: null,
        netProfit: 0,
        retainedEarningsTransfer: 0,
        closedAt: closed.closedAt,
      };
    }

    const retainedEarningsAccountId = await this.resolveRetainedEarningsAccountId(ctx.companyId);

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
      throw new AppError(400, 'السنة المالية ليست مغلقة');
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
        `لا يمكن فتح هذه السنة قبل فتح السنة اللاحقة (${laterClosedYear.arabicName || laterClosedYear.legacyYearId}) أولاً.`
      );
    }

    return prisma.$transaction(async (tx) => {
      if (year.closingJournalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, year.closingJournalEntryId, {
          date: year.endDate,
          reason: 'إلغاء قيد إقفال السنة المالية',
        });
      }

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
