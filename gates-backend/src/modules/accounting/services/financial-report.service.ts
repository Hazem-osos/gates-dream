import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4, amountsEqualAt4 } from '../../../shared/utils/decimal-round';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import {
  accountTreeLevel,
  classifyAccount,
  splitTrialBalanceColumns,
  verifyTrialBalanceBalanced,
  type AccountClass,
} from './financial-report.util';
import { rebuildCompanyBalances } from './ledger-balance.service';

export interface FinancialReportBaseParams {
  companyId: string;
  branchId?: string;
  fiscalYearId?: string;
  startDate?: Date;
  endDate?: Date;
  asOfDate?: Date;
  costCenterId?: string;
}

export interface TrialBalanceParams extends FinancialReportBaseParams {
  startDate: Date;
  endDate: Date;
  level?: number;
}

export interface AccountStatementParams extends FinancialReportBaseParams {
  accountId: string;
  startDate: Date;
  endDate: Date;
}

export interface IncomeStatementParams extends FinancialReportBaseParams {
  startDate: Date;
  endDate: Date;
}

export interface BalanceSheetParams extends FinancialReportBaseParams {
  asOfDate: Date;
}

export interface CashFlowParams extends FinancialReportBaseParams {
  startDate: Date;
  endDate: Date;
  page?: number;
  limit?: number;
}

function journalEntryFilterSql(
  params: FinancialReportBaseParams,
  lineAlias: string,
  entryAlias: string
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(entryAlias)}.companyId = ${params.companyId}`,
    Prisma.sql`${Prisma.raw(entryAlias)}.isPosted = true`,
    Prisma.sql`${Prisma.raw(entryAlias)}.isCancelled = false`,
    Prisma.sql`${Prisma.raw(entryAlias)}.deletedAt IS NULL`,
  ];
  if (params.branchId) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.branchId = ${params.branchId}`);
  }
  if (params.fiscalYearId) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.fiscalYearId = ${params.fiscalYearId}`);
  }
  if (params.costCenterId) {
    parts.push(Prisma.sql`${Prisma.raw(lineAlias)}.costCenterId = ${params.costCenterId}`);
  }
  return Prisma.join(parts, ' AND ');
}

function usesLiveJournalSum(params: FinancialReportBaseParams): boolean {
  return Boolean(params.branchId || params.costCenterId || params.fiscalYearId);
}

export class FinancialReportService {
  async getTrialBalance(params: TrialBalanceParams) {
    if (!usesLiveJournalSum(params)) {
      return this.getTrialBalanceFromPeriodBalances(params);
    }
    return this.getTrialBalanceFromJournalLines(params);
  }

  private async getTrialBalanceFromPeriodBalances(params: TrialBalanceParams) {
    const [summaryCount, postedCount] = await Promise.all([
      prisma.accountPeriodBalance.count({ where: { companyId: params.companyId } }),
      prisma.journalEntry.count({
        where: {
          companyId: params.companyId,
          isPosted: true,
          isCancelled: false,
          deletedAt: null,
        },
      }),
    ]);
    if (summaryCount === 0 && postedCount > 0) {
      await prisma.$transaction((tx) => rebuildCompanyBalances(tx, params.companyId));
    }

    const start = params.startDate;
    const end = params.endDate;
    const startYear = start.getUTCFullYear();
    const startMonth = start.getUTCMonth() + 1;
    const endYear = end.getUTCFullYear();
    const endMonth = end.getUTCMonth() + 1;

    type Row = {
      accountId: string;
      code: string;
      arabicName: string;
      accountType: string | null;
      openingNet: unknown;
      periodDebit: unknown;
      periodCredit: unknown;
    };

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        a.id AS accountId,
        a.code,
        a.arabicName,
        a.accountType,
        COALESCE(SUM(
          CASE
            WHEN apb.fiscalYear < ${startYear}
              OR (apb.fiscalYear = ${startYear} AND apb.periodMonth < ${startMonth})
            THEN apb.netBalance
            ELSE 0
          END
        ), 0) AS openingNet,
        COALESCE(SUM(
          CASE
            WHEN (apb.fiscalYear > ${startYear} OR (apb.fiscalYear = ${startYear} AND apb.periodMonth >= ${startMonth}))
             AND (apb.fiscalYear < ${endYear} OR (apb.fiscalYear = ${endYear} AND apb.periodMonth <= ${endMonth}))
            THEN apb.debitTotal
            ELSE 0
          END
        ), 0) AS periodDebit,
        COALESCE(SUM(
          CASE
            WHEN (apb.fiscalYear > ${startYear} OR (apb.fiscalYear = ${startYear} AND apb.periodMonth >= ${startMonth}))
             AND (apb.fiscalYear < ${endYear} OR (apb.fiscalYear = ${endYear} AND apb.periodMonth <= ${endMonth}))
            THEN apb.creditTotal
            ELSE 0
          END
        ), 0) AS periodCredit
      FROM accounts a
      LEFT JOIN account_period_balances apb
        ON apb.accountId = a.id AND apb.companyId = a.companyId
      WHERE a.companyId = ${params.companyId}
        AND (a.deletedAt IS NULL OR apb.id IS NOT NULL)
      GROUP BY a.id, a.code, a.arabicName, a.accountType
    `);

    return this.mapTrialBalanceRows(rows, params);
  }

  private async getTrialBalanceFromJournalLines(params: TrialBalanceParams) {
    const jeFilter = journalEntryFilterSql(params, 'jel', 'je');
    const start = params.startDate;
    const end = params.endDate;

    type Row = {
      accountId: string;
      code: string;
      arabicName: string;
      accountType: string | null;
      openingNet: unknown;
      periodDebit: unknown;
      periodCredit: unknown;
    };

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        a.id AS accountId,
        a.code,
        a.arabicName,
        a.accountType,
        COALESCE(SUM(
          CASE WHEN je.date < ${start} THEN (jel.debitBase - jel.creditBase) ELSE 0 END
        ), 0) AS openingNet,
        COALESCE(SUM(
          CASE WHEN je.date >= ${start} AND je.date <= ${end} THEN jel.debitBase ELSE 0 END
        ), 0) AS periodDebit,
        COALESCE(SUM(
          CASE WHEN je.date >= ${start} AND je.date <= ${end} THEN jel.creditBase ELSE 0 END
        ), 0) AS periodCredit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.accountId = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journalEntryId
        AND ${jeFilter}
      WHERE a.companyId = ${params.companyId}
        -- A retired account that still carries posted lines must stay in the trial balance,
        -- otherwise hiding it silently unbalances the report.
        AND (a.deletedAt IS NULL OR jel.id IS NOT NULL)
      GROUP BY a.id, a.code, a.arabicName, a.accountType
    `);

    return this.mapTrialBalanceRows(rows, params);
  }

  private mapTrialBalanceRows(
    rows: Array<{
      accountId: string;
      code: string;
      arabicName: string;
      accountType: string | null;
      openingNet: unknown;
      periodDebit: unknown;
      periodCredit: unknown;
    }>,
    params: TrialBalanceParams
  ) {
    const accounts = rows
      .filter((r) => accountTreeLevel(r.code, params.level))
      .map((r) => {
        const openingNet = roundTo4(Number(r.openingNet));
        const periodDebit = roundTo4(Number(r.periodDebit));
        const periodCredit = roundTo4(Number(r.periodCredit));
        const closingNet = roundTo4(openingNet + periodDebit - periodCredit);
        const openingSplit = splitTrialBalanceColumns(openingNet);
        const closingSplit = splitTrialBalanceColumns(closingNet);
        return {
          accountId: r.accountId,
          code: r.code,
          arabicName: r.arabicName,
          accountType: r.accountType,
          openingDebit: openingSplit.endingDebit,
          openingCredit: openingSplit.endingCredit,
          periodDebit,
          periodCredit,
          endingDebit: closingSplit.endingDebit,
          endingCredit: closingSplit.endingCredit,
          closingNet,
        };
      })
      .filter(
        (r) =>
          r.periodDebit !== 0 ||
          r.periodCredit !== 0 ||
          r.openingDebit !== 0 ||
          r.openingCredit !== 0 ||
          r.endingDebit !== 0 ||
          r.endingCredit !== 0
      );

    const verification = verifyTrialBalanceBalanced(accounts);

    return {
      accounts,
      verification,
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        branchId: params.branchId,
        fiscalYearId: params.fiscalYearId,
        costCenterId: params.costCenterId,
      },
    };
  }

  async getAccountStatement(params: AccountStatementParams) {
    const account = await prisma.account.findFirst({
      where: { id: params.accountId, companyId: params.companyId, deletedAt: null },
    });
    if (!account) throw new AppError(404, 'Account not found');

    const jeFilter = journalEntryFilterSql(params, 'jel', 'je');

    const openingRows = await prisma.$queryRaw<Array<{ openingNet: unknown }>>(Prisma.sql`
      SELECT COALESCE(SUM(jel.debitBase - jel.creditBase), 0) AS openingNet
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE jel.accountId = ${params.accountId}
        AND je.date < ${params.startDate}
        AND ${jeFilter}
    `);
    let running = roundTo4(Number(openingRows[0]?.openingNet ?? 0));

    type LineRow = {
      id: string;
      entryDate: Date;
      legacyGlNum: string | null;
      sourceType: string | null;
      sourceNumber: string | null;
      description: string | null;
      debitBase: unknown;
      creditBase: unknown;
    };

    const lines = await prisma.$queryRaw<LineRow[]>(Prisma.sql`
      SELECT
        jel.id,
        je.date AS entryDate,
        je.legacyGlNum,
        je.sourceType,
        je.sourceNumber,
        COALESCE(jel.description, je.description) AS description,
        jel.debitBase,
        jel.creditBase
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE jel.accountId = ${params.accountId}
        AND je.date >= ${params.startDate}
        AND je.date <= ${params.endDate}
        AND ${jeFilter}
      ORDER BY je.date ASC, je.legacyGlNum ASC, jel.lineOrder ASC
    `);

    const transactions = lines.map((line) => {
      const debitBase = roundTo4(Number(line.debitBase));
      const creditBase = roundTo4(Number(line.creditBase));
      running = roundTo4(running + debitBase - creditBase);
      return {
        lineId: line.id,
        entryDate: line.entryDate,
        legacyGlNum: line.legacyGlNum,
        sourceType: line.sourceType,
        sourceNumber: line.sourceNumber,
        description: line.description,
        debitBase,
        creditBase,
        runningBalance: running,
      };
    });

    const openingNet = roundTo4(Number(openingRows[0]?.openingNet ?? 0));
    const closingBalance = running;

    return {
      account: {
        id: account.id,
        code: account.code,
        arabicName: account.arabicName,
      },
      openingBalance: openingNet,
      closingBalance,
      transactions,
    };
  }

  private async aggregateByAccountClass(
    params: FinancialReportBaseParams & { startDate?: Date; endDate?: Date; asOfDate?: Date }
  ) {
    const jeFilter = journalEntryFilterSql(params, 'jel', 'je');
    const dateBefore = params.asOfDate ?? params.endDate;
    const rangeStart = params.startDate;
    const rangeEnd = params.endDate ?? params.asOfDate;

    let dateClause: Prisma.Sql;
    if (params.asOfDate && !params.startDate) {
      dateClause = Prisma.sql`je.date <= ${params.asOfDate}`;
    } else if (rangeStart && rangeEnd) {
      dateClause = Prisma.sql`je.date >= ${rangeStart} AND je.date <= ${rangeEnd}`;
    } else {
      throw new AppError(422, 'Date range or asOfDate required');
    }

    type AggRow = {
      accountId: string;
      code: string;
      arabicName: string;
      accountType: string | null;
      netAmount: unknown;
    };

    const rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
      SELECT
        a.id AS accountId,
        a.code,
        a.arabicName,
        a.accountType,
        COALESCE(SUM(jel.creditBase - jel.debitBase), 0) AS netAmount
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      INNER JOIN accounts a ON a.id = jel.accountId
      WHERE ${jeFilter}
        AND ${dateClause}
      GROUP BY a.id, a.code, a.arabicName, a.accountType
    `);

    const byClass: Record<AccountClass, number> = {
      ASSET: 0,
      LIABILITY: 0,
      EQUITY: 0,
      REVENUE: 0,
      COGS: 0,
      EXPENSE: 0,
      OTHER: 0,
    };

    const detail: Array<{
      accountId: string;
      code: string;
      arabicName: string;
      class: AccountClass;
      amount: number;
    }> = [];

    for (const row of rows) {
      const cls = classifyAccount(row.code, row.accountType);
      let amount = roundTo4(Number(row.netAmount));
      if (cls === 'ASSET') {
        amount = roundTo4(-amount);
      } else if (cls === 'LIABILITY' || cls === 'EQUITY') {
        amount = roundTo4(Number(row.netAmount));
      } else if (cls === 'REVENUE') {
        amount = roundTo4(Number(row.netAmount));
      } else if (cls === 'COGS' || cls === 'EXPENSE') {
        amount = roundTo4(-Number(row.netAmount));
      }
      if (amount === 0) continue;
      byClass[cls] = roundTo4(byClass[cls] + amount);
      detail.push({
        accountId: row.accountId,
        code: row.code,
        arabicName: row.arabicName,
        class: cls,
        amount,
      });
    }

    return { byClass, detail, dateBefore };
  }

  async getIncomeStatement(params: IncomeStatementParams) {
    const { byClass, detail } = await this.aggregateByAccountClass(params);

    const totalRevenue = byClass.REVENUE;
    const totalCogs = byClass.COGS;
    const grossProfit = roundTo4(totalRevenue - totalCogs);
    const operatingExpenses = byClass.EXPENSE;
    const operatingProfit = roundTo4(grossProfit - operatingExpenses);
    const netProfit = operatingProfit;

    return {
      revenues: totalRevenue,
      costOfGoodsSold: totalCogs,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      netProfit,
      lines: detail.filter((d) =>
        ['REVENUE', 'COGS', 'EXPENSE'].includes(d.class)
      ),
      summary: {
        totalRevenue,
        costOfGoodsSold: totalCogs,
        grossProfit,
        totalExpenses: operatingExpenses,
        netProfit,
      },
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        costCenterId: params.costCenterId,
      },
    };
  }

  async getBalanceSheet(params: BalanceSheetParams) {
    const asOfParams: FinancialReportBaseParams & { asOfDate: Date } = {
      ...params,
      asOfDate: params.asOfDate,
    };

    const { byClass, detail } = await this.aggregateByAccountClass(asOfParams);

    const fyResolution = await fiscalYearService.resolveForDate(
      params.companyId,
      params.asOfDate
    );
    const yearStart =
      fyResolution.kind !== 'invalid'
        ? (
            await prisma.fiscalYear.findFirst({
              where: { id: fyResolution.fiscalYearId, companyId: params.companyId },
              select: { startDate: true },
            })
          )?.startDate ?? new Date(Date.UTC(params.asOfDate.getUTCFullYear(), 0, 1))
        : new Date(Date.UTC(params.asOfDate.getUTCFullYear(), 0, 1));

    const pl = await this.getIncomeStatement({
      ...params,
      startDate: yearStart,
      endDate: params.asOfDate,
    });

    const openPnl = roundTo4(
      byClass.REVENUE - byClass.COGS - byClass.EXPENSE
    );
    const totalAssets = byClass.ASSET;
    const totalLiabilities = byClass.LIABILITY;
    const totalEquity = roundTo4(byClass.EQUITY + openPnl);

    const equationLeft = roundTo4(totalAssets);
    const equationRight = roundTo4(
      totalLiabilities + totalEquity + byClass.OTHER
    );
    const equationBalanced = amountsEqualAt4(equationLeft, equationRight);

    // H17 fix: `sections` used to be `{ assets: number, liabilities: number,
    // equity: number }` — three totals, not renderable rows. The generic
    // report viewer's extractor only accepts arrays, so the preview always
    // rendered an empty grid. Each section is now an array of account rows,
    // and `lines` is the same rows flattened (tagged with `section`) so the
    // universal extractor picks it up exactly like the income statement does.
    const assetRows = detail.filter((d) => d.class === 'ASSET');
    const liabilityRows = detail.filter((d) => d.class === 'LIABILITY');
    const equityRows = detail.filter((d) => d.class === 'EQUITY');
    if (openPnl !== 0) {
      equityRows.push({
        accountId: 'current-period-pnl',
        code: '',
        arabicName: 'أرباح (خسائر) الفترة الحالية',
        class: 'EQUITY',
        amount: openPnl,
      });
    }
    const sectioned = (rows: typeof detail, section: string) =>
      rows.map((r) => ({ ...r, section }));

    return {
      asOfDate: params.asOfDate,
      assets: totalAssets,
      liabilities: totalLiabilities,
      equityExcludingCurrentProfit: byClass.EQUITY,
      currentPeriodNetIncome: pl.netProfit,
      openPeriodPnl: openPnl,
      totalEquity,
      verification: {
        equationBalanced,
        totalAssets: equationLeft,
        totalLiabilitiesAndEquity: equationRight,
      },
      sections: {
        assets: assetRows,
        liabilities: liabilityRows,
        equity: equityRows,
      },
      lines: [
        ...sectioned(assetRows, 'ASSETS'),
        ...sectioned(liabilityRows, 'LIABILITIES'),
        ...sectioned(equityRows, 'EQUITY'),
      ],
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        equationBalanced,
      },
    };
  }

  /**
   * H20 fix: the legacy `/cash-flow` report just listed journal lines
   * touching a hardcoded "CASH" `accountType` filter (a scalar-vs-relation
   * bug that likely matched nothing) and summed transaction-currency
   * `debit`/`credit` instead of `debitBase`/`creditBase` — wrong for any
   * foreign-currency cash account and not a cash-flow *statement* at all
   * (no operating/investing/financing classification).
   *
   * This builds a real indirect-method statement from the GL:
   *   - "Cash" = every account actually used as a Safe/BankAccount GL
   *     account, plus the two system cash/bank codes — not a fragile
   *     accountType string match.
   *   - Every other account touched in the period is bucketed into
   *     Operating (net income + working-capital accounts: AR/AP and their
   *     customer/supplier sub-accounts, inventory, VAT, WHT, customer
   *     advances, cheques), Investing (fixed assets / other non-current
   *     assets), or Financing (equity, non-current liabilities).
   *   - Because *every* non-cash account is bucketed somewhere, and the
   *     GL is double-entry, Operating + Investing + Financing is
   *     mathematically guaranteed to equal the actual change in the GL
   *     cash accounts — `reconciled` below is a real tie-out, not a
   *     restatement.
   */
  async getCashFlowStatement(params: CashFlowParams) {
    const { companyId, branchId, startDate, endDate, costCenterId } = params;
    const page = params.page ?? 1;
    const limit = params.limit ?? 500;

    const [cashAccountIds, arSubAccountIds, apSubAccountIds] = await Promise.all([
      this.resolveCashAccountIds(companyId),
      this.resolvePartySubAccountIds(companyId, 'customer'),
      this.resolvePartySubAccountIds(companyId, 'supplier'),
    ]);

    const { detail } = await this.aggregateByAccountClass({
      companyId,
      branchId,
      costCenterId,
      startDate,
      endDate,
    });

    const nonCash = detail.filter((d) => !cashAccountIds.has(d.accountId));

    const CURRENT_ASSET_CODES = new Set<string>([
      SYSTEM_GL_CODES.ar,
      SYSTEM_GL_CODES.inventory,
      SYSTEM_GL_CODES.whtReceivable,
      SYSTEM_GL_CODES.vatInput,
      SYSTEM_GL_CODES.chequesInHand,
      SYSTEM_GL_CODES.chequesUnderCollection,
      SYSTEM_GL_CODES.retentionReceivable,
    ]);
    const CURRENT_LIABILITY_CODES = new Set<string>([
      SYSTEM_GL_CODES.ap,
      SYSTEM_GL_CODES.notesPayable,
      SYSTEM_GL_CODES.vatOutput,
      SYSTEM_GL_CODES.whtPayable,
      SYSTEM_GL_CODES.customerAdvance,
      SYSTEM_GL_CODES.retentionPayable,
    ]);

    type CashFlowLine = {
      accountId: string;
      code: string;
      arabicName: string;
      section: 'OPERATING' | 'INVESTING' | 'FINANCING';
      amount: number;
    };

    const lines: CashFlowLine[] = [];
    let workingCapitalChange = 0;
    let investingCF = 0;
    let financingCF = 0;

    for (const row of nonCash) {
      // Cash contribution: an increase in an asset is a *use* of cash, an
      // increase in a liability/equity/revenue is a *source* of cash, and
      // an increase in an expense/COGS is a *use* of cash. `row.amount`
      // from aggregateByAccountClass is already "increase in this
      // account's own natural balance", sign-adjusted per class, so we
      // flip it back for the classes where that adjustment inverted the
      // sign relative to the underlying (credit - debit) GL movement.
      const contribution =
        row.class === 'ASSET' || row.class === 'COGS' || row.class === 'EXPENSE'
          ? roundTo4(-row.amount)
          : roundTo4(row.amount);
      if (contribution === 0) continue;

      if (row.class === 'REVENUE' || row.class === 'COGS' || row.class === 'EXPENSE') {
        // Rolled into the single "Net Income" line below instead of one
        // row per revenue/expense account — this is a cash flow
        // statement, not a second income statement.
        continue;
      }
      if (row.class === 'ASSET') {
        const isCurrent = CURRENT_ASSET_CODES.has(row.code) || arSubAccountIds.has(row.accountId);
        if (isCurrent) {
          workingCapitalChange = roundTo4(workingCapitalChange + contribution);
          lines.push({ ...row, section: 'OPERATING', amount: contribution });
        } else {
          investingCF = roundTo4(investingCF + contribution);
          lines.push({ ...row, section: 'INVESTING', amount: contribution });
        }
        continue;
      }
      if (row.class === 'LIABILITY') {
        const isCurrent =
          CURRENT_LIABILITY_CODES.has(row.code) || apSubAccountIds.has(row.accountId);
        if (isCurrent) {
          workingCapitalChange = roundTo4(workingCapitalChange + contribution);
          lines.push({ ...row, section: 'OPERATING', amount: contribution });
        } else {
          financingCF = roundTo4(financingCF + contribution);
          lines.push({ ...row, section: 'FINANCING', amount: contribution });
        }
        continue;
      }
      // EQUITY (and OTHER, defensively) — capital contributions/
      // withdrawals and retained-earnings movements are financing.
      financingCF = roundTo4(financingCF + contribution);
      lines.push({ ...row, section: 'FINANCING', amount: contribution });
    }

    const pl = await this.getIncomeStatement({ companyId, branchId, costCenterId, startDate, endDate });
    const netIncome = pl.netProfit;
    const operatingCF = roundTo4(netIncome + workingCapitalChange);
    const netChangeInCash = roundTo4(operatingCF + investingCF + financingCF);

    const cashBalance = await this.cashAccountBalance(cashAccountIds, companyId, branchId, endDate);
    const cashBalanceBeforeStart = await this.cashAccountBalance(
      cashAccountIds,
      companyId,
      branchId,
      new Date(startDate.getTime() - 1)
    );
    const actualCashChange = roundTo4(cashBalance - cashBalanceBeforeStart);
    const variance = roundTo4(netChangeInCash - actualCashChange);
    const reconciled = Math.abs(variance) < 0.01;

    const netIncomeLine: CashFlowLine = {
      accountId: 'net-income',
      code: '',
      arabicName: 'صافي الربح (الخسارة)',
      section: 'OPERATING',
      amount: roundTo4(netIncome),
    };
    const allLines = [netIncomeLine, ...lines];
    const total = allLines.length;
    const skip = (page - 1) * limit;
    const pageLines = allLines.slice(skip, skip + limit);

    return {
      startDate,
      endDate,
      operatingActivities: {
        netIncome,
        workingCapitalChange,
        total: operatingCF,
      },
      investingActivities: { total: investingCF },
      financingActivities: { total: financingCF },
      netChangeInCash,
      cashAtBeginning: roundTo4(cashBalanceBeforeStart),
      cashAtEnd: roundTo4(cashBalance),
      reconciliation: {
        netChangeInCash,
        actualCashChangeFromGl: actualCashChange,
        variance,
        reconciled,
      },
      lines: pageLines,
      summary: {
        netIncome,
        operatingCashFlow: operatingCF,
        investingCashFlow: investingCF,
        financingCashFlow: financingCF,
        netChangeInCash,
        cashAtBeginning: roundTo4(cashBalanceBeforeStart),
        cashAtEnd: roundTo4(cashBalance),
        reconciled,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async resolveCashAccountIds(companyId: string): Promise<Set<string>> {
    const [byCode, safes, banks] = await Promise.all([
      prisma.account.findMany({
        where: { companyId, code: { in: [SYSTEM_GL_CODES.cashMain, SYSTEM_GL_CODES.bankDefault] } },
        select: { id: true },
      }),
      prisma.safe.findMany({ where: { companyId }, select: { glAccountId: true } }),
      prisma.bankAccount.findMany({ where: { companyId }, select: { glAccountId: true } }),
    ]);
    return new Set<string>([
      ...byCode.map((a) => a.id),
      ...safes.map((s) => s.glAccountId).filter((x): x is string => !!x),
      ...banks.map((b) => b.glAccountId).filter((x): x is string => !!x),
    ]);
  }

  private async resolvePartySubAccountIds(
    companyId: string,
    party: 'customer' | 'supplier'
  ): Promise<Set<string>> {
    const rows =
      party === 'customer'
        ? await prisma.customer.findMany({
            where: { companyId },
            select: { mainAccountId: true, accountId: true },
          })
        : await prisma.supplier.findMany({
            where: { companyId },
            select: { mainAccountId: true, accountId: true },
          });
    return new Set<string>([
      ...rows.map((r) => r.mainAccountId).filter((x): x is string => !!x),
      ...rows.map((r) => r.accountId).filter((x): x is string => !!x),
    ]);
  }

  /** Net (debitBase - creditBase) balance of the given cash-equivalent accounts as of a date. */
  private async cashAccountBalance(
    accountIds: Set<string>,
    companyId: string,
    branchId: string | undefined,
    asOfDate: Date
  ): Promise<number> {
    if (accountIds.size === 0) return 0;
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: { in: [...accountIds] },
        journalEntry: {
          companyId,
          isPosted: true,
          isCancelled: false,
          deletedAt: null,
          date: { lte: asOfDate },
          ...(branchId ? { branchId } : {}),
        },
      },
      _sum: { debitBase: true, creditBase: true },
    });
    return roundTo4(Number(agg._sum.debitBase ?? 0) - Number(agg._sum.creditBase ?? 0));
  }

  async getCostCenterReport(
    params: FinancialReportBaseParams & { startDate: Date; endDate: Date }
  ) {
    const jeFilter = journalEntryFilterSql(params, 'jel', 'je');

    type CcRow = {
      costCenterId: string | null;
      code: string | null;
      arabicName: string | null;
      totalDebit: unknown;
      totalCredit: unknown;
    };

    const rows = await prisma.$queryRaw<CcRow[]>(Prisma.sql`
      SELECT
        jel.costCenterId,
        cc.code,
        cc.arabicName,
        COALESCE(SUM(jel.debitBase), 0) AS totalDebit,
        COALESCE(SUM(jel.creditBase), 0) AS totalCredit
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      LEFT JOIN cost_centers cc ON cc.id = jel.costCenterId
      WHERE ${jeFilter}
        AND je.date >= ${params.startDate}
        AND je.date <= ${params.endDate}
        AND jel.costCenterId IS NOT NULL
      GROUP BY jel.costCenterId, cc.code, cc.arabicName
      ORDER BY cc.code ASC
    `);

    const centers = rows.map((r) => ({
      costCenterId: r.costCenterId,
      code: r.code,
      arabicName: r.arabicName,
      totalDebit: roundTo4(Number(r.totalDebit)),
      totalCredit: roundTo4(Number(r.totalCredit)),
      net: roundTo4(Number(r.totalDebit) - Number(r.totalCredit)),
    }));

    return {
      centers,
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
    };
  }
}

export const financialReportService = new FinancialReportService();
