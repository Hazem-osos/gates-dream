import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4, amountsEqualAt4 } from '../../../shared/utils/decimal-round';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import {
  arrangeTrialBalanceTree,
  buildCostCenterProfitability,
  buildMonthlyPerformance,
  classifyAccount,
  idsWithBudgetedLineage,
  ledgerSectionClose,
  selectTrialBalanceRows,
  splitTrialBalanceColumns,
  verifyTrialBalanceBalanced,
  type AccountClass,
} from './financial-report.util';
import { rebuildCompanyBalances } from './ledger-balance.service';
import { voucherFundBySourceId } from '../utils/voucher-fund';

export interface FinancialReportBaseParams {
  companyId: string;
  branchId?: string;
  fiscalYearId?: string;
  startDate?: Date;
  endDate?: Date;
  asOfDate?: Date;
  costCenterId?: string;
  /** Selected center plus every center under it. */
  costCenterIds?: string[];
  currencyCode?: string;
  fromVoucher?: number;
  toVoucher?: number;
  /** User who created the journal entry. */
  createdBy?: string;
  /** Include draft journals. Posted-only stays the default. */
  includeUnposted?: boolean;
  /** Keep accounts / cost centers that have a budget amount. */
  withBudgetOnly?: boolean;
}

export interface TrialBalanceParams extends FinancialReportBaseParams {
  startDate: Date;
  endDate: Date;
  level?: number;
  /** Selected account. The report keeps that account and every account under it. */
  accountId?: string;
  currencyId?: string;
  /** Keep accounts that have no opening and no movement. */
  showIdleAccounts?: boolean;
}

export interface AccountStatementParams extends FinancialReportBaseParams {
  accountId: string;
  startDate: Date;
  endDate: Date;
  /** How many levels under the selected account. Omitted = the whole subtree. */
  level?: number;
  description?: string;
  counterpartAccountId?: string;
  currencyId?: string;
}

export interface CostCenterStatementParams extends FinancialReportBaseParams {
  costCenterId: string;
  startDate: Date;
  endDate: Date;
  /** How many levels under the selected cost center. Omitted = the whole subtree. */
  level?: number;
  description?: string;
  counterpartAccountId?: string;
  currencyId?: string;
  /** Optional account filter, same role cost center plays on the account ledger. */
  accountId?: string;
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
    Prisma.sql`${Prisma.raw(entryAlias)}.isCancelled = false`,
    Prisma.sql`${Prisma.raw(entryAlias)}.deletedAt IS NULL`,
  ];
  if (!params.includeUnposted) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.isPosted = true`);
  }
  if (params.branchId) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.branchId = ${params.branchId}`);
  }
  if (params.createdBy) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.createdBy = ${params.createdBy}`);
  }
  if (params.fiscalYearId) {
    parts.push(Prisma.sql`${Prisma.raw(entryAlias)}.fiscalYearId = ${params.fiscalYearId}`);
  }
  const centerIds = params.costCenterIds?.length
    ? params.costCenterIds
    : params.costCenterId
      ? [params.costCenterId]
      : [];
  if (centerIds.length === 1) {
    parts.push(Prisma.sql`${Prisma.raw(lineAlias)}.costCenterId = ${centerIds[0]}`);
  } else if (centerIds.length > 1) {
    parts.push(Prisma.sql`${Prisma.raw(lineAlias)}.costCenterId IN (${Prisma.join(centerIds)})`);
  }
  if (params.currencyCode) {
    parts.push(
      Prisma.sql`(${Prisma.raw(entryAlias)}.currencyCode = ${params.currencyCode} OR ${Prisma.raw(lineAlias)}.currencyCode = ${params.currencyCode})`
    );
  }
  if (params.fromVoucher != null) {
    parts.push(
      Prisma.sql`CAST(${Prisma.raw(entryAlias)}.voucherNumber AS DECIMAL(20, 4)) >= ${params.fromVoucher}`
    );
  }
  if (params.toVoucher != null) {
    parts.push(
      Prisma.sql`CAST(${Prisma.raw(entryAlias)}.voucherNumber AS DECIMAL(20, 4)) <= ${params.toVoucher}`
    );
  }
  return Prisma.join(parts, ' AND ');
}

function subtreeAccountIds(
  rootId: string,
  accounts: Array<{ id: string; parentId: string | null }>,
  maxDepth?: number
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parentId) continue;
    const bucket = childrenByParent.get(account.parentId) ?? [];
    bucket.push(account.id);
    childrenByParent.set(account.parentId, bucket);
  }
  const result = [rootId];
  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (maxDepth != null && Number.isFinite(maxDepth) && maxDepth > 0 && current.depth >= maxDepth) {
      continue;
    }
    for (const childId of childrenByParent.get(current.id) ?? []) {
      result.push(childId);
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }
  return result;
}

function accountPathLabel(
  accountId: string,
  accountById: Map<string, { id: string; parentId: string | null; code: string; arabicName: string }>
): string {
  const parts: string[] = [];
  let current = accountById.get(accountId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(`${current.code} — ${current.arabicName}`);
    current = current.parentId ? accountById.get(current.parentId) : undefined;
  }
  return parts.join(' › ');
}

function accountIdsAtRelativeLevel(
  rootId: string,
  accounts: Array<{ id: string; parentId: string | null }>,
  level: number
): string[] {
  if (level <= 1) return [rootId];
  let frontier = [rootId];
  for (let depth = 1; depth < level; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const account of accounts) {
        if (account.parentId === id) next.push(account.id);
      }
    }
    frontier = next;
  }
  return frontier;
}

function accountStatementLineFilters(
  params: AccountStatementParams,
  currencyCode?: string,
  counterpartIds?: string[]
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  const description = params.description?.trim();
  if (description) {
    const needle = `%${description.replace(/[%_\\]/g, '')}%`;
    parts.push(
      Prisma.sql`COALESCE(jel.description, je.description, '') LIKE ${needle}`
    );
  }
  if (counterpartIds?.length) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM journal_entry_lines other
      WHERE other.journalEntryId = jel.journalEntryId
        AND other.id <> jel.id
        AND other.accountId IN (${Prisma.join(counterpartIds)})
    )`);
  }
  if (currencyCode) {
    parts.push(Prisma.sql`(
      jel.currencyCode = ${currencyCode}
      OR ((jel.currencyCode IS NULL OR jel.currencyCode = '') AND je.currencyCode = ${currencyCode})
    )`);
  }
  return Prisma.join(parts, ' AND ');
}

function postedFlag(value: boolean | number | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return Number(value) === 1;
}

function ledgerPostingStatusLabel(status: string | null, isPosted: boolean): string {
  const value = (status ?? '').trim().toLowerCase();
  if (isPosted || value === 'post' || value === 'posted') return 'مرحّل';
  return 'غير مرحّل';
}

type LedgerLine = {
  accountName: string;
  accountPath: string;
  debitBase: number;
  creditBase: number;
  runningBalance: number;
  description: string | null;
  rowKind?: string;
};

function ledgerFooterRow<T extends LedgerLine>(
  sample: T,
  patch: {
    description: string;
    debitBase: number;
    creditBase: number;
    runningBalance: number;
    rowKind: 'opening' | 'total';
  }
): T {
  return {
    ...sample,
    description: patch.description,
    debitBase: patch.debitBase,
    creditBase: patch.creditBase,
    runningBalance: patch.runningBalance,
    rowKind: patch.rowKind,
    legacyGlNum: null,
    sourceType: null,
    sourceKind: null,
    entryType: null,
    voucherFund: null,
    sourceNumber: null,
    counterpartAccount: null,
    costCenterName: null,
    entryLockStatus: null,
    postingPosition: null,
    journalEntryId: null,
    lineId: null,
    sourceId: null,
    entryDate: null,
    movementCurrency: null,
    exchangeRate: null,
  } as T;
}

function withAccountSubtotals<T extends LedgerLine>(lines: T[]): T[] {
  if (lines.length === 0) return lines;
  const out: T[] = [];
  let index = 0;
  while (index < lines.length) {
    const accountName = lines[index].accountName;
    const group: T[] = [];
    while (index < lines.length && lines[index].accountName === accountName) {
      group.push(lines[index]);
      index += 1;
    }
    const close = ledgerSectionClose(group);
    if (close.opening !== 0) {
      out.push(
        ledgerFooterRow(group[0], {
          description: 'رصيد ما قبله',
          debitBase: close.openingDebit,
          creditBase: close.openingCredit,
          runningBalance: close.opening,
          rowKind: 'opening',
        })
      );
    }
    out.push(...group);
    out.push(
      ledgerFooterRow(group[group.length - 1], {
        description: 'الإجمالي',
        debitBase: close.debit,
        creditBase: close.credit,
        runningBalance: close.balance,
        rowKind: 'total',
      })
    );
  }
  return out;
}

function levelSummaryRows<T extends LedgerLine & { accountId?: string }>(
  nodeIds: string[],
  accountById: Map<string, { id: string; parentId: string | null; code: string; arabicName: string }>,
  lines: T[],
  openingByAccount: Map<string, number>,
  tree: Array<{ id: string; parentId: string | null }>
): T[] {
  return nodeIds.map((nodeId) => {
    const node = accountById.get(nodeId);
    const label = node ? `${node.code} — ${node.arabicName}` : nodeId;
    const memberIds = new Set(subtreeAccountIds(nodeId, tree));
    let debit = 0;
    let credit = 0;
    let opening = 0;
    for (const id of memberIds) opening = roundTo4(opening + (openingByAccount.get(id) ?? 0));
    for (const line of lines) {
      if (!line.accountId || !memberIds.has(line.accountId)) continue;
      debit = roundTo4(debit + line.debitBase);
      credit = roundTo4(credit + line.creditBase);
    }
    const sample = lines[0];
    return {
      ...(sample ?? ({} as T)),
      accountName: label,
      accountPath: accountPathLabel(nodeId, accountById),
      description: 'إجمالي',
      debitBase: debit,
      creditBase: credit,
      runningBalance: roundTo4(opening + debit - credit),
      legacyGlNum: null,
      sourceType: null,
      sourceKind: null,
      entryType: null,
      voucherFund: null,
      sourceNumber: null,
      counterpartAccount: null,
      costCenterName: null,
      entryLockStatus: null,
      postingPosition: null,
      journalEntryId: null,
      lineId: null,
      entryDate: null,
      rowKind: 'total',
    } as T;
  });
}

function usesLiveJournalSum(params: FinancialReportBaseParams): boolean {
  return Boolean(
    params.includeUnposted ||
      params.branchId ||
      params.costCenterId ||
      params.fiscalYearId ||
      params.currencyCode ||
      params.fromVoucher != null ||
      params.toVoucher != null
  );
}

export class FinancialReportService {
  private async withCostCenterSubtree<T extends FinancialReportBaseParams>(params: T): Promise<T> {
    if (!params.costCenterId || params.costCenterIds?.length) return params;
    const centers = await prisma.costCenter.findMany({
      where: { companyId: params.companyId },
      select: { id: true, parentId: true },
    });
    if (!centers.some((center) => center.id === params.costCenterId)) {
      throw new AppError(400, 'مركز التكلفة غير موجود');
    }
    return { ...params, costCenterIds: subtreeAccountIds(params.costCenterId, centers) };
  }

  async getTrialBalance(params: TrialBalanceParams) {
    params = await this.withCostCenterSubtree(params);
    if (params.currencyId) {
      const currency = await prisma.currency.findFirst({
        where: { id: params.currencyId, companyId: params.companyId },
        select: { code: true },
      });
      if (!currency) throw new AppError(400, 'العملة غير موجودة');
      params = { ...params, currencyCode: currency.code };
    }
    const tree = await prisma.account.findMany({
      where: { companyId: params.companyId, deletedAt: null },
      select: { id: true, parentId: true, code: true },
    });
    if (params.accountId && !tree?.some((account) => account.id === params.accountId)) {
      throw new AppError(404, 'Account not found');
    }
    const budgetKeep = params.withBudgetOnly
      ? await this.budgetedAccountKeepIds(params.companyId, tree)
      : undefined;
    if (!usesLiveJournalSum(params)) {
      return this.getTrialBalanceFromPeriodBalances(params, tree, budgetKeep);
    }
    return this.getTrialBalanceFromJournalLines(params, tree, budgetKeep);
  }

  private async budgetedAccountKeepIds(
    companyId: string,
    tree: Array<{ id: string; parentId: string | null }>
  ) {
    const budgeted = await prisma.account.findMany({
      where: { companyId, deletedAt: null, budget: { gt: 0 } },
      select: { id: true },
    });
    return idsWithBudgetedLineage(tree, budgeted.map((account) => account.id));
  }

  private async getTrialBalanceFromPeriodBalances(
    params: TrialBalanceParams,
    tree?: Array<{ id: string; parentId: string | null }>,
    budgetKeep?: Set<string>
  ) {
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

    return this.mapTrialBalanceRows(rows, params, tree, budgetKeep);
  }

  private async getTrialBalanceFromJournalLines(
    params: TrialBalanceParams,
    tree?: Array<{ id: string; parentId: string | null }>,
    budgetKeep?: Set<string>
  ) {
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

    return this.mapTrialBalanceRows(rows, params, tree, budgetKeep);
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
    params: TrialBalanceParams,
    tree?: Array<{ id: string; parentId: string | null; code?: string }>,
    budgetKeep?: Set<string>
  ) {
    const scoped = selectTrialBalanceRows(rows, {
      accountId: params.accountId,
      tree,
    }).filter((row) => !budgetKeep || budgetKeep.has(row.accountId));
    const ownAccounts = scoped
      .filter((r) => Number(r.openingNet) !== 0 || Number(r.periodDebit) !== 0 || Number(r.periodCredit) !== 0)
      .map((r) => {
        const openingNet = roundTo4(Number(r.openingNet));
        const periodDebit = roundTo4(Number(r.periodDebit));
        const periodCredit = roundTo4(Number(r.periodCredit));
        const closing = splitTrialBalanceColumns(roundTo4(openingNet + periodDebit - periodCredit));
        return { endingDebit: closing.endingDebit, endingCredit: closing.endingCredit };
      });
    const accounts = arrangeTrialBalanceTree(scoped, tree ?? [], {
      maxDepth: params.level && params.level > 0 ? params.level : undefined,
    }).map((r) => {
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
          depth: r.depth,
          isGroup: r.isGroup,
        };
      })
      .filter(
        (r) =>
          params.showIdleAccounts ||
          r.periodDebit !== 0 ||
          r.periodCredit !== 0 ||
          r.openingDebit !== 0 ||
          r.openingCredit !== 0 ||
          r.endingDebit !== 0 ||
          r.endingCredit !== 0
      );

    const verification = verifyTrialBalanceBalanced(ownAccounts);

    return {
      accounts,
      verification,
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        branchId: params.branchId,
        fiscalYearId: params.fiscalYearId,
        costCenterId: params.costCenterId,
        accountId: params.accountId,
      },
    };
  }

  async getAccountStatement(params: AccountStatementParams) {
    const account = await prisma.account.findFirst({
      where: { id: params.accountId, companyId: params.companyId, deletedAt: null },
    });
    if (!account) throw new AppError(404, 'Account not found');

    const tree = await prisma.account.findMany({
      where: { companyId: params.companyId, deletedAt: null },
      select: { id: true, parentId: true, code: true, arabicName: true },
    });
    const accountIds = subtreeAccountIds(account.id, tree);
    const accountById = new Map(tree.map((row) => [row.id, row]));
    const levelNodes =
      params.level && params.level > 0
        ? accountIdsAtRelativeLevel(account.id, tree, params.level)
        : null;
    const accountIdSql = Prisma.join(accountIds);

    let currency: { code: string; arabicName: string } | null = null;
    if (params.currencyId) {
      const row = await prisma.currency.findFirst({
        where: { id: params.currencyId, companyId: params.companyId },
        select: { code: true, arabicName: true },
      });
      if (!row) throw new AppError(400, 'Currency not found');
      currency = row;
    }

    const counterpart = params.counterpartAccountId
      ? accountById.get(params.counterpartAccountId) ??
        (await prisma.account.findFirst({
          where: { id: params.counterpartAccountId, companyId: params.companyId, deletedAt: null },
          select: { id: true, code: true, arabicName: true },
        }))
      : null;
    if (params.counterpartAccountId && !counterpart) {
      throw new AppError(400, 'الحساب المقابل غير موجود');
    }
    const counterpartIds = params.counterpartAccountId
      ? subtreeAccountIds(params.counterpartAccountId, tree)
      : undefined;

    let costCenterLabel: string | null = null;
    let statementParams = params;
    if (params.costCenterId) {
      const centers = await prisma.costCenter.findMany({
        where: { companyId: params.companyId },
        select: { id: true, parentId: true, code: true, arabicName: true },
      });
      const center = centers.find((row) => row.id === params.costCenterId);
      if (!center) throw new AppError(400, 'مركز التكلفة غير موجود');
      costCenterLabel = `${center.code} — ${center.arabicName}`;
      const costCenterIds = subtreeAccountIds(center.id, centers);
      statementParams = { ...params, costCenterIds };
    }

    const jeFilter = journalEntryFilterSql(statementParams, 'jel', 'je');
    const lineFilters = accountStatementLineFilters(params, currency?.code, counterpartIds);

    const openingRows = await prisma.$queryRaw<Array<{ accountId: string; openingNet: unknown }>>(Prisma.sql`
      SELECT jel.accountId AS accountId, COALESCE(SUM(jel.debitBase - jel.creditBase), 0) AS openingNet
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE jel.accountId IN (${accountIdSql})
        AND je.date < ${params.startDate}
        AND ${jeFilter}
        AND ${lineFilters}
      GROUP BY jel.accountId
    `);
    const openingByAccount = new Map(
      openingRows.map((row) => [row.accountId, roundTo4(Number(row.openingNet))])
    );

    type LineRow = {
      id: string;
      journalEntryId: string;
      sourceId: string | null;
      accountId: string;
      accountCode: string;
      accountName: string;
      entryDate: Date;
      legacyGlNum: string | null;
      sourceType: string | null;
      sourceKind: string | null;
      entryType: string | null;
      sourceNumber: string | null;
      description: string | null;
      debitBase: unknown;
      creditBase: unknown;
      lineOrder: number;
      movementCurrency: string | null;
      exchangeRate: unknown;
      counterpartAccount: string | null;
      costCenterName: string | null;
      documentStatus: string | null;
      postingStatus: string | null;
      isPosted: boolean | number;
      isApproved: boolean | number | null;
    };

    const lines = await prisma.$queryRaw<LineRow[]>(Prisma.sql`
      SELECT
        jel.id,
        je.id AS journalEntryId,
        je.sourceId,
        jel.accountId AS accountId,
        a.code AS accountCode,
        a.arabicName AS accountName,
        je.date AS entryDate,
        je.legacyGlNum,
        je.sourceType,
        je.sourceKind,
        je.entryType,
        je.sourceNumber,
        COALESCE(jel.description, je.description) AS description,
        jel.debitBase,
        jel.creditBase,
        jel.lineOrder,
        COALESCE(cur.arabicName, NULLIF(jel.currencyCode, ''), je.currencyCode) AS movementCurrency,
        COALESCE(jel.exchangeRate, je.exchangeRate) AS exchangeRate,
        (
          SELECT GROUP_CONCAT(DISTINCT CONCAT(oa.code, ' — ', oa.arabicName) ORDER BY oa.code SEPARATOR '، ')
          FROM journal_entry_lines other
          INNER JOIN accounts oa ON oa.id = other.accountId
          WHERE other.journalEntryId = jel.journalEntryId
            AND other.accountId <> jel.accountId
        ) AS counterpartAccount,
        CASE
          WHEN cc.id IS NULL THEN NULL
          ELSE CONCAT(cc.code, ' — ', cc.arabicName)
        END AS costCenterName,
        je.documentStatus,
        je.postingStatus,
        je.isPosted,
        je.isApproved
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      INNER JOIN accounts a ON a.id = jel.accountId
      LEFT JOIN cost_centers cc ON cc.id = jel.costCenterId
      LEFT JOIN currencies cur ON cur.companyId = je.companyId
        AND cur.code = COALESCE(NULLIF(jel.currencyCode, ''), je.currencyCode)
      WHERE jel.accountId IN (${accountIdSql})
        AND je.date >= ${params.startDate}
        AND je.date <= ${params.endDate}
        AND ${jeFilter}
        AND ${lineFilters}
      ORDER BY a.code ASC, je.date ASC, je.legacyGlNum ASC, jel.lineOrder ASC
    `);

    const funds = await voucherFundBySourceId(
      params.companyId,
      lines.map((line) => line.sourceId)
    );
    const runningByAccount = new Map<string, number>();
    const transactions = lines.map((line) => {
      const debitBase = roundTo4(Number(line.debitBase));
      const creditBase = roundTo4(Number(line.creditBase));
      const prior = runningByAccount.has(line.accountId)
        ? runningByAccount.get(line.accountId)!
        : (openingByAccount.get(line.accountId) ?? 0);
      const running = roundTo4(prior + debitBase - creditBase);
      runningByAccount.set(line.accountId, running);
      const accountLabel = line.accountCode
        ? `${line.accountCode} — ${line.accountName}`
        : line.accountName;
      return {
        lineId: line.id,
        accountId: line.accountId,
        journalEntryId: line.journalEntryId,
        sourceId: line.sourceId,
        accountName: accountLabel,
        accountPath: accountPathLabel(line.accountId, accountById),
        entryDate: line.entryDate,
        legacyGlNum: line.legacyGlNum,
        sourceType: line.sourceType,
        sourceKind: line.sourceKind,
        entryType: line.entryType,
        voucherFund: line.sourceId ? funds.get(line.sourceId) ?? null : null,
        sourceNumber: line.sourceNumber,
        description: line.description,
        debitBase,
        creditBase,
        runningBalance: running,
        movementCurrency: line.movementCurrency,
        exchangeRate: roundTo4(Number(line.exchangeRate ?? 1)),
        counterpartAccount: line.counterpartAccount,
        costCenterName: line.costCenterName,
        entryLockStatus: postedFlag(line.isApproved) ? 'مؤيد' : 'غير مؤيد',
        postingPosition: ledgerPostingStatusLabel(line.postingStatus, postedFlag(line.isPosted)),
      };
    });

    let openingNet = 0;
    for (const id of accountIds) openingNet = roundTo4(openingNet + (openingByAccount.get(id) ?? 0));
    let periodNet = 0;
    for (const line of transactions) periodNet = roundTo4(periodNet + line.debitBase - line.creditBase);

    const visibleTransactions = levelNodes
      ? levelSummaryRows(levelNodes, accountById, transactions, openingByAccount, tree)
      : withAccountSubtotals(transactions);

    return {
      account: {
        id: account.id,
        code: account.code,
        arabicName: account.arabicName,
      },
      currencyName: currency?.arabicName ?? null,
      counterpartAccountName: counterpart
        ? `${counterpart.code} — ${counterpart.arabicName}`
        : null,
      costCenterName: costCenterLabel,
      openingBalance: openingNet,
      closingBalance: roundTo4(openingNet + periodNet),
      transactions: visibleTransactions,
    };
  }

  /**
   * Same ledger as {@link getAccountStatement}, with the cost center tree
   * in place of the account tree. Row fields keep the account-ledger names
   * so the grid, subtotals, and running balance stay identical; `accountName`
   * is the center and `costCenterName` is the GL account on the line.
   */
  async getCostCenterStatement(params: CostCenterStatementParams) {
    const centers = await prisma.costCenter.findMany({
      where: { companyId: params.companyId },
      select: { id: true, parentId: true, code: true, arabicName: true },
    });
    const center = centers.find((row) => row.id === params.costCenterId);
    if (!center) throw new AppError(404, 'مركز التكلفة غير موجود');

    const centerById = new Map(centers.map((row) => [row.id, row]));
    const centerIds = subtreeAccountIds(center.id, centers);
    const levelNodes =
      params.level && params.level > 0
        ? accountIdsAtRelativeLevel(center.id, centers, params.level)
        : null;
    const centerIdSql = Prisma.join(centerIds);

    const accounts = await prisma.account.findMany({
      where: { companyId: params.companyId, deletedAt: null },
      select: { id: true, parentId: true, code: true, arabicName: true },
    });
    const accountById = new Map(accounts.map((row) => [row.id, row]));
    const accountIds = params.accountId ? subtreeAccountIds(params.accountId, accounts) : null;
    if (params.accountId && !accountById.has(params.accountId)) {
      throw new AppError(400, 'Account not found');
    }

    let currency: { code: string; arabicName: string } | null = null;
    if (params.currencyId) {
      const row = await prisma.currency.findFirst({
        where: { id: params.currencyId, companyId: params.companyId },
        select: { code: true, arabicName: true },
      });
      if (!row) throw new AppError(400, 'Currency not found');
      currency = row;
    }

    const counterpart = params.counterpartAccountId ? accountById.get(params.counterpartAccountId) : null;
    if (params.counterpartAccountId && !counterpart) {
      throw new AppError(400, 'الحساب المقابل غير موجود');
    }
    const counterpartIds = params.counterpartAccountId
      ? subtreeAccountIds(params.counterpartAccountId, accounts)
      : undefined;

    const statementParams: FinancialReportBaseParams = {
      companyId: params.companyId,
      branchId: params.branchId,
      fiscalYearId: params.fiscalYearId,
    };
    const jeFilter = journalEntryFilterSql(statementParams, 'jel', 'je');
    const lineFilters = accountStatementLineFilters(
      {
        ...params,
        accountId: params.accountId ?? params.costCenterId,
      },
      currency?.code,
      counterpartIds
    );
    const accountFilter = accountIds?.length
      ? Prisma.sql`jel.accountId IN (${Prisma.join(accountIds)})`
      : Prisma.sql`1 = 1`;

    const openingRows = await prisma.$queryRaw<Array<{ costCenterId: string; openingNet: unknown }>>(Prisma.sql`
      SELECT jel.costCenterId AS costCenterId, COALESCE(SUM(jel.debitBase - jel.creditBase), 0) AS openingNet
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE jel.costCenterId IN (${centerIdSql})
        AND ${accountFilter}
        AND je.date < ${params.startDate}
        AND ${jeFilter}
        AND ${lineFilters}
      GROUP BY jel.costCenterId
    `);
    const openingByCenter = new Map(
      openingRows.map((row) => [row.costCenterId, roundTo4(Number(row.openingNet))])
    );

    const lines = await prisma.$queryRaw<
      Array<{
        id: string;
        journalEntryId: string;
        sourceId: string | null;
        costCenterId: string;
        centerCode: string;
        centerName: string;
        accountCode: string;
        accountName: string;
        entryDate: Date;
        legacyGlNum: string | null;
        sourceType: string | null;
        sourceKind: string | null;
        entryType: string | null;
        sourceNumber: string | null;
        description: string | null;
        debitBase: unknown;
        creditBase: unknown;
        lineOrder: number;
        movementCurrency: string | null;
        exchangeRate: unknown;
        counterpartAccount: string | null;
        postingStatus: string | null;
        isPosted: boolean | number;
        isApproved: boolean | number | null;
      }>
    >(Prisma.sql`
      SELECT
        jel.id,
        je.id AS journalEntryId,
        je.sourceId,
        jel.costCenterId AS costCenterId,
        cc.code AS centerCode,
        cc.arabicName AS centerName,
        a.code AS accountCode,
        a.arabicName AS accountName,
        je.date AS entryDate,
        je.legacyGlNum,
        je.sourceType,
        je.sourceKind,
        je.entryType,
        je.sourceNumber,
        COALESCE(jel.description, je.description) AS description,
        jel.debitBase,
        jel.creditBase,
        jel.lineOrder,
        COALESCE(cur.arabicName, NULLIF(jel.currencyCode, ''), je.currencyCode) AS movementCurrency,
        COALESCE(jel.exchangeRate, je.exchangeRate) AS exchangeRate,
        (
          SELECT GROUP_CONCAT(DISTINCT CONCAT(oa.code, ' — ', oa.arabicName) ORDER BY oa.code SEPARATOR '، ')
          FROM journal_entry_lines other
          INNER JOIN accounts oa ON oa.id = other.accountId
          WHERE other.journalEntryId = jel.journalEntryId
            AND other.accountId <> jel.accountId
        ) AS counterpartAccount,
        je.postingStatus,
        je.isPosted,
        je.isApproved
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      INNER JOIN cost_centers cc ON cc.id = jel.costCenterId
      INNER JOIN accounts a ON a.id = jel.accountId
      LEFT JOIN currencies cur ON cur.companyId = je.companyId
        AND cur.code = COALESCE(NULLIF(jel.currencyCode, ''), je.currencyCode)
      WHERE jel.costCenterId IN (${centerIdSql})
        AND ${accountFilter}
        AND je.date >= ${params.startDate}
        AND je.date <= ${params.endDate}
        AND ${jeFilter}
        AND ${lineFilters}
      ORDER BY cc.code ASC, je.date ASC, je.legacyGlNum ASC, jel.lineOrder ASC
    `);

    const funds = await voucherFundBySourceId(
      params.companyId,
      lines.map((line) => line.sourceId)
    );
    const runningByCenter = new Map<string, number>();
    const transactions = lines.map((line) => {
      const debitBase = roundTo4(Number(line.debitBase));
      const creditBase = roundTo4(Number(line.creditBase));
      const prior = runningByCenter.has(line.costCenterId)
        ? runningByCenter.get(line.costCenterId)!
        : (openingByCenter.get(line.costCenterId) ?? 0);
      const running = roundTo4(prior + debitBase - creditBase);
      runningByCenter.set(line.costCenterId, running);
      const centerLabel = line.centerCode ? `${line.centerCode} — ${line.centerName}` : line.centerName;
      const accountLabel = line.accountCode ? `${line.accountCode} — ${line.accountName}` : line.accountName;
      return {
        lineId: line.id,
        accountId: line.costCenterId,
        journalEntryId: line.journalEntryId,
        sourceId: line.sourceId,
        accountName: centerLabel,
        accountPath: accountPathLabel(line.costCenterId, centerById),
        entryDate: line.entryDate,
        legacyGlNum: line.legacyGlNum,
        sourceType: line.sourceType,
        sourceKind: line.sourceKind,
        entryType: line.entryType,
        voucherFund: line.sourceId ? funds.get(line.sourceId) ?? null : null,
        sourceNumber: line.sourceNumber,
        description: line.description,
        debitBase,
        creditBase,
        runningBalance: running,
        movementCurrency: line.movementCurrency,
        exchangeRate: roundTo4(Number(line.exchangeRate ?? 1)),
        counterpartAccount: line.counterpartAccount,
        costCenterName: accountLabel,
        entryLockStatus: postedFlag(line.isApproved) ? 'مؤيد' : 'غير مؤيد',
        postingPosition: ledgerPostingStatusLabel(line.postingStatus, postedFlag(line.isPosted)),
      };
    });

    let openingNet = 0;
    for (const id of centerIds) openingNet = roundTo4(openingNet + (openingByCenter.get(id) ?? 0));
    let periodNet = 0;
    for (const line of transactions) periodNet = roundTo4(periodNet + line.debitBase - line.creditBase);

    const visibleTransactions = levelNodes
      ? levelSummaryRows(levelNodes, centerById, transactions, openingByCenter, centers)
      : withAccountSubtotals(transactions);

    const account = params.accountId ? accountById.get(params.accountId) : null;
    return {
      account: account
        ? { id: account.id, code: account.code, arabicName: account.arabicName }
        : undefined,
      currencyName: currency?.arabicName ?? null,
      counterpartAccountName: counterpart ? `${counterpart.code} — ${counterpart.arabicName}` : null,
      costCenterName: `${center.code} — ${center.arabicName}`,
      openingBalance: openingNet,
      closingBalance: roundTo4(openingNet + periodNet),
      transactions: visibleTransactions,
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

    const budgetSql = params.withBudgetOnly
      ? Prisma.sql`AND COALESCE(a.budget, 0) > 0`
      : Prisma.empty;

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
        ${budgetSql}
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

  private async companyCurrencyName(companyId: string): Promise<string> {
    const settings = await prisma.companySettings.findFirst({
      where: { companyId },
      select: { defaultCurrency: true },
    });
    const code = settings?.defaultCurrency?.trim() || 'EGP';
    const currency = await prisma.currency.findFirst({
      where: { companyId, code },
      select: { arabicName: true },
    });
    return currency?.arabicName?.trim() || (code === 'EGP' ? 'جنيه مصري' : code);
  }

  private async withAccountGroups<T extends { accountId: string }>(
    companyId: string,
    lines: T[]
  ): Promise<Array<T & { groupPath: string; groupNames: string }>> {
    if (!lines.length) return [];
    const accounts = await prisma.account.findMany({
      where: { companyId },
      select: { id: true, parentId: true, code: true, arabicName: true },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return lines.map((line) => {
      const chain: Array<{ code: string; arabicName: string }> = [];
      const seen = new Set<string>();
      let current = byId.get(line.accountId);
      while (current?.parentId && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        const parent = byId.get(current.parentId);
        if (!parent) break;
        chain.unshift({ code: parent.code, arabicName: parent.arabicName });
        current = parent;
      }
      return {
        ...line,
        groupPath: chain.map((item) => item.code).join('|'),
        groupNames: chain.map((item) => item.arabicName).join('|'),
      };
    });
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
      lines: await this.withAccountGroups(
        params.companyId,
        detail.filter((d) => ['REVENUE', 'COGS', 'EXPENSE'].includes(d.class))
      ),
      summary: {
        totalRevenue,
        costOfGoodsSold: totalCogs,
        grossProfit,
        totalExpenses: operatingExpenses,
        netProfit,
        currencyName: await this.companyCurrencyName(params.companyId),
      },
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        costCenterId: params.costCenterId,
      },
    };
  }

  async getMonthlyPerformance(params: FinancialReportBaseParams & { year: number; month: number }) {
    const scoped = await this.withCostCenterSubtree(params);
    const from = new Date(Date.UTC(scoped.year - 1, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(scoped.year, 11, 31, 23, 59, 59, 999));
    const monthStart = new Date(Date.UTC(scoped.year, scoped.month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(scoped.year, scoped.month, 0, 23, 59, 59, 999));
    const jeFilter = journalEntryFilterSql(scoped, 'jel', 'je');

    type AggRow = {
      year: number | bigint;
      month: number | bigint;
      accountId: string;
      code: string;
      arabicName: string;
      accountType: string | null;
      netAmount: unknown;
    };

    const aggregated = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
      SELECT
        YEAR(je.date) AS year,
        MONTH(je.date) AS month,
        a.id AS accountId,
        a.code,
        a.arabicName,
        a.accountType,
        COALESCE(SUM(jel.creditBase - jel.debitBase), 0) AS netAmount
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      INNER JOIN accounts a ON a.id = jel.accountId
      WHERE ${jeFilter}
        AND je.date >= ${from}
        AND je.date <= ${to}
      GROUP BY YEAR(je.date), MONTH(je.date), a.id, a.code, a.arabicName, a.accountType
    `);

    const rows = aggregated.flatMap((row) => {
      const cls = classifyAccount(row.code, row.accountType);
      if (cls !== 'REVENUE' && cls !== 'COGS' && cls !== 'EXPENSE') return [];
      const net = roundTo4(Number(row.netAmount));
      const amount = cls === 'REVENUE' ? net : roundTo4(-net);
      if (amount === 0) return [];
      return [{
        year: Number(row.year),
        month: Number(row.month),
        class: cls,
        amount,
        accountId: row.accountId,
        code: row.code,
        arabicName: row.arabicName,
      }];
    });

    type BalanceRow = { debit: unknown; credit: unknown };
    const [balance] = await prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(jel.debitBase), 0) AS debit,
        COALESCE(SUM(jel.creditBase), 0) AS credit
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE ${jeFilter}
        AND je.date >= ${monthStart}
        AND je.date <= ${monthEnd}
    `);
    const debit = roundTo4(Number(balance?.debit ?? 0));
    const credit = roundTo4(Number(balance?.credit ?? 0));
    const centerIds = scoped.costCenterIds?.length
      ? scoped.costCenterIds
      : scoped.costCenterId
        ? [scoped.costCenterId]
        : [];
    const unpostedCount = await prisma.journalEntry.count({
      where: {
        companyId: scoped.companyId,
        isPosted: false,
        isCancelled: false,
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
        ...(scoped.branchId ? { branchId: scoped.branchId } : {}),
        ...(centerIds.length ? { lines: { some: { costCenterId: { in: centerIds } } } } : {}),
      },
    });

    return {
      ...buildMonthlyPerformance(scoped.year, scoped.month, rows),
      currencyName: await this.companyCurrencyName(scoped.companyId),
      books: {
        balanced: amountsEqualAt4(debit, credit),
        debit,
        credit,
        difference: roundTo4(debit - credit),
        unpostedCount,
      },
    };
  }

  async getCostCenterProfitability(params: FinancialReportBaseParams & { year: number; month: number }) {
    const from = new Date(Date.UTC(params.year, 0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(params.year, 11, 31, 23, 59, 59, 999));
    const jeFilter = journalEntryFilterSql(
      { companyId: params.companyId, branchId: params.branchId },
      'jel',
      'je'
    );
    type AggRow = {
      year: number | bigint;
      month: number | bigint;
      costCenterId: string | null;
      code: string;
      accountType: string | null;
      netAmount: unknown;
    };
    const aggregated = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
      SELECT
        YEAR(je.date) AS year,
        MONTH(je.date) AS month,
        jel.costCenterId AS costCenterId,
        a.code,
        a.accountType,
        COALESCE(SUM(jel.creditBase - jel.debitBase), 0) AS netAmount
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      INNER JOIN accounts a ON a.id = jel.accountId
      WHERE ${jeFilter}
        AND je.date >= ${from}
        AND je.date <= ${to}
      GROUP BY YEAR(je.date), MONTH(je.date), jel.costCenterId, a.code, a.accountType
    `);
    const folded = new Map<string, { year: number; month: number; costCenterId: string | null; class: 'REVENUE' | 'COGS' | 'EXPENSE'; amount: number }>();
    for (const row of aggregated) {
      const cls = classifyAccount(row.code, row.accountType);
      if (cls !== 'REVENUE' && cls !== 'COGS' && cls !== 'EXPENSE') continue;
      const net = roundTo4(Number(row.netAmount));
      const amount = cls === 'REVENUE' ? net : roundTo4(-net);
      if (amount === 0) continue;
      const year = Number(row.year);
      const month = Number(row.month);
      const key = `${year}|${month}|${row.costCenterId ?? ''}|${cls}`;
      const existing = folded.get(key);
      if (existing) existing.amount = roundTo4(existing.amount + amount);
      else folded.set(key, { year, month, costCenterId: row.costCenterId, class: cls, amount });
    }
    const centers = await prisma.costCenter.findMany({
      where: { companyId: params.companyId },
      select: { id: true, code: true, arabicName: true },
    });
    return {
      ...buildCostCenterProfitability(params.year, params.month, [...folded.values()], centers),
      year: params.year,
      month: params.month,
      currencyName: await this.companyCurrencyName(params.companyId),
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

    const sheet = await this.buildBalanceSheetSides(params.companyId, detail, openPnl);

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
      sheet,
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        equationBalanced,
      },
    };
  }

  private async buildBalanceSheetSides(
    companyId: string,
    detail: Array<{ accountId: string; class: string; amount: number }>,
    openPnl: number
  ) {
    const accounts = await prisma.account.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true, code: true, arabicName: true, accountType: true },
      orderBy: { code: 'asc' },
    });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const children = new Map<string, typeof accounts>();
    for (const account of accounts) {
      if (!account.parentId || !byId.has(account.parentId)) continue;
      const bucket = children.get(account.parentId) ?? [];
      bucket.push(account);
      children.set(account.parentId, bucket);
    }
    const direct = new Map<string, number>();
    for (const row of detail) {
      if (row.class !== 'ASSET' && row.class !== 'LIABILITY' && row.class !== 'EQUITY') continue;
      direct.set(row.accountId, roundTo4((direct.get(row.accountId) ?? 0) + row.amount));
    }
    const sideOf = (account: (typeof accounts)[number]) => {
      const cls = classifyAccount(account.code, account.accountType);
      if (cls === 'ASSET') return 'assets';
      if (cls === 'LIABILITY' || cls === 'EQUITY') return 'liabilities';
      return null;
    };

    const rolled = new Map<string, number>();
    const roll = (id: string): number => {
      const cached = rolled.get(id);
      if (cached != null) return cached;
      const account = byId.get(id);
      const side = account ? sideOf(account) : null;
      let sum = side ? (direct.get(id) ?? 0) : 0;
      for (const child of children.get(id) ?? []) {
        const childSum = roll(child.id);
        if (side && sideOf(child) === side) sum = roundTo4(sum + childSum);
      }
      rolled.set(id, sum);
      return sum;
    };
    for (const account of accounts) roll(account.id);

    const flatten = (account: (typeof accounts)[number], depth: number, side: 'assets' | 'liabilities') => {
      const amount = rolled.get(account.id) ?? 0;
      if (amount === 0) return [] as Array<{ code: string; arabicName: string; amount: number; depth: number }>;
      const rows = [{ code: account.code, arabicName: account.arabicName, amount, depth }];
      for (const child of children.get(account.id) ?? []) {
        if (sideOf(child) !== side) continue;
        rows.push(...flatten(child, depth + 1, side));
      }
      return rows;
    };

    const roots = accounts.filter((account) => {
      const side = sideOf(account);
      if (!side) return false;
      const parent = account.parentId ? byId.get(account.parentId) : undefined;
      return !parent || sideOf(parent) !== side;
    });
    const assets = roots
      .filter((account) => sideOf(account) === 'assets')
      .flatMap((account) => flatten(account, 0, 'assets'));
    const liabilities = roots
      .filter((account) => sideOf(account) === 'liabilities')
      .flatMap((account) => flatten(account, 0, 'liabilities'));
    if (openPnl !== 0) {
      liabilities.push({
        code: '',
        arabicName: 'أرباح (خسائر) الفترة الحالية',
        amount: openPnl,
        depth: 0,
      });
    }
    return { assets, liabilities };
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
      includeUnposted: params.includeUnposted,
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
