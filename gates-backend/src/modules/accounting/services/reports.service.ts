import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { financialReportService } from './financial-report.service';
import { agedOpenItemsService, type AgingBucketKey } from './aged-open-items.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { classifyAccount, isTradingStatementAccount, splitTrialBalanceColumns } from './financial-report.util';
import {
  accountDisplayLabel,
  amountMatches,
  collectSubtreeIds,
  parseDailyJournalAccountView,
  parseDailyJournalAmountOp,
  parseOptionalNumber,
  voucherNumberInRange,
} from '../utils/daily-journal-filters';
import { resolveJournalSourceKind } from '../utils/journal-source';
import { voucherFundBySourceId } from '../utils/voucher-fund';
import {
  SECURITIES_PAPER_CASE_LABEL,
  resolveSecuritiesPaperCase,
} from '../utils/securities-paper-case';
import {
  formatPaperAccountLabel,
  openingPaperStatus,
  paperReportAccountName,
  paperSideWheres,
} from '../utils/paper-report-where';
import { loadCurrencyCatalog, moneyInReportCurrency } from '../utils/company-fx-rate';
import { buildSafeMovementRows, type SafeLedgerLine } from './safe-movement-sheet';
import {
  journalApprovalStatusLabel,
  journalEntryIsApprovedFlag,
} from '../utils/journal-approval-status';
import { buildCostCenterBudgetRows } from './cost-center-budget';

export interface ReportFilters {
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
  branchId?: string;
  accountId?: string;
  costCenterId?: string;
  customerId?: string;
  supplierId?: string;
  warehouseId?: string;
  itemId?: string;
  employeeId?: string;
  period?: string;
  [key: string]: any; // Allow additional filters
}

export interface ReportOptions {
  includeDetails?: boolean;
  includeSummary?: boolean;
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function currencyCodeFor(companyId: string, currencyId?: string) {
  if (!currencyId) return undefined;
  const currency = await prisma.currency.findFirst({
    where: { id: String(currencyId), companyId },
    select: { code: true },
  });
  if (!currency) throw new Error('العملة غير موجودة');
  return currency.code;
}

async function reportMoneyContext(companyId: string, currencyId?: string) {
  const catalog = await loadCurrencyCatalog(companyId);
  const selected = currencyId ? await currencyCodeFor(companyId, currencyId) : undefined;
  const reportCurrency = (selected || catalog.companyBase).toUpperCase();
  return { ...catalog, reportCurrency };
}

function convertedAmount(
  ctx: Awaited<ReturnType<typeof reportMoneyContext>>,
  row: { face: number; base?: number | null; currencyCode?: string | null; exchangeRate?: number | null }
) {
  return roundTo4(
    moneyInReportCurrency({
      face: row.face,
      base: row.base,
      currencyCode: row.currencyCode,
      exchangeRate: row.exchangeRate,
      reportCurrency: ctx.reportCurrency,
      companyBase: ctx.companyBase,
      catalog: ctx.rates,
    })
  );
}

async function postedFundLedgerLines(
  companyId: string,
  accountIds: string[],
  money: Awaited<ReturnType<typeof reportMoneyContext>>,
  scope: { branchId?: string; toDate?: Date; userId?: string; includeUnposted?: boolean }
): Promise<SafeLedgerLine[]> {
  if (!accountIds.length) return [];
  const rawLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: { in: accountIds },
      journalEntry: {
        companyId,
        ...(scope.includeUnposted ? {} : { isPosted: true }),
        isCancelled: false,
        deletedAt: null,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        ...(scope.toDate ? { date: { lte: scope.toDate } } : {}),
        ...(scope.userId ? { createdBy: scope.userId } : {}),
      },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
    select: {
      accountId: true,
      debit: true,
      credit: true,
      debitBase: true,
      creditBase: true,
      currencyCode: true,
      exchangeRate: true,
      description: true,
      descriptionAr: true,
      journalEntry: {
        select: {
          id: true,
          date: true,
          voucherNumber: true,
          sourceNumber: true,
          sourceType: true,
          sourceKind: true,
          sourceId: true,
          entryType: true,
          description: true,
          descriptionAr: true,
          currencyCode: true,
          exchangeRate: true,
          lines: {
            select: {
              accountId: true,
              account: { select: { arabicName: true } },
            },
          },
        },
      },
    },
  });

  const funds = await voucherFundBySourceId(
    companyId,
    rawLines.map((line) => line.journalEntry.sourceId)
  );

  return rawLines.map((line) => {
    const entry = line.journalEntry;
    const rate = Number(line.exchangeRate ?? entry.exchangeRate ?? 1);
    const code = line.currencyCode || entry.currencyCode;
    const names = [
      ...new Set(
        entry.lines
          .filter((other) => other.accountId !== line.accountId)
          .map((other) => other.account.arabicName)
          .filter((name): name is string => Boolean(name))
      ),
    ];
    return {
      accountId: line.accountId,
      date: entry.date,
      debit: convertedAmount(money, {
        face: Number(line.debit || 0),
        base: Number(line.debitBase || 0),
        currencyCode: code,
        exchangeRate: rate,
      }),
      credit: convertedAmount(money, {
        face: Number(line.credit || 0),
        base: Number(line.creditBase || 0),
        currencyCode: code,
        exchangeRate: rate,
      }),
      description: line.description || line.descriptionAr || entry.description || entry.descriptionAr || '',
      voucherNumber: entry.voucherNumber || entry.sourceNumber || '',
      journalEntryId: entry.id,
      entryType: entry.entryType,
      sourceType: entry.sourceType,
      sourceKind: entry.sourceKind,
      sourceId: entry.sourceId,
      voucherFund: entry.sourceId ? funds.get(entry.sourceId) ?? null : null,
      counterpart: names.join('، '),
    };
  });
}

async function accountSubtreeIds(companyId: string, accountId?: string) {
  if (!accountId) return undefined;
  const tree = await prisma.account.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  return collectSubtreeIds(String(accountId), tree);
}


const journalLineInclude = {
  account: { select: { id: true, code: true, arabicName: true } },
  costCenter: { select: { id: true, code: true, arabicName: true } },
} satisfies Prisma.JournalEntryLineInclude;

async function journalLineMatch(companyId: string, accountId?: string, costCenterId?: string) {
  const accountIds = await accountSubtreeIds(companyId, accountId);
  const centerIds = await costCenterIdsFor(companyId, costCenterId);
  const lineWhere: Prisma.JournalEntryLineWhereInput = {};
  if (accountIds) lineWhere.accountId = { in: accountIds };
  if (centerIds) lineWhere.costCenterId = { in: centerIds };
  return accountIds || centerIds ? lineWhere : undefined;
}

async function costCenterIdsFor(companyId: string, costCenterId?: string) {
  if (!costCenterId) return undefined;
  const tree = await prisma.costCenter.findMany({
    where: { companyId },
    select: { id: true, parentId: true },
  });
  return collectSubtreeIds(String(costCenterId), tree);
}

const BANK_ORIGIN_LABELS: Record<string, string> = {
  PAYMENT_VOUCHER: 'إشعار خصم بنكي',
  RECEIPT_VOUCHER: 'إشعار إضافة بنكي',
  SALES_INVOICE: 'فاتورة مبيعات',
  SALES_RETURN: 'مرتجع مبيعات',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  PURCHASE_RETURN: 'مرتجع مشتريات',
  CHEQUE_ENDORSEMENT: 'شيك',
  SECURITIES_RECEIPT: 'ورقة قبض',
  SECURITIES_PAYMENT: 'ورقة دفع',
  STOCK_TRANSACTION: 'حركة مخزنية',
};

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function bankMovementOrigin(
  sourceType: string | null,
  sourceKind: string | null,
  side: 'in' | 'out',
  entryType?: string | null
) {
  const source = String(sourceType ?? '').trim().toUpperCase().split('-')[0];
  if (source === 'OB' || source === 'OPEN' || String(entryType ?? '').toUpperCase() === 'OPENING_STOCK') {
    return 'بضاعة أول المدة';
  }
  if (String(entryType ?? '').toUpperCase() === 'OPENING_BALANCE') return 'قيد افتتاحي';
  const kind = resolveJournalSourceKind(sourceType, sourceKind);
  if (kind === 'PAYMENT_VOUCHER') return 'إشعار خصم بنكي';
  if (kind === 'RECEIPT_VOUCHER') return 'إشعار إضافة بنكي';
  return BANK_ORIGIN_LABELS[kind] || (side === 'out' ? 'إشعار خصم بنكي' : 'إشعار إضافة بنكي');
}

function listMonths(fromDate: Date, toDate: Date) {
  const months: Array<{ start: Date; end: Date; label: string }> = [];
  let year = fromDate.getUTCFullYear();
  let month = fromDate.getUTCMonth();
  const endYear = toDate.getUTCFullYear();
  const endMonth = toDate.getUTCMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    months.push({
      start,
      end,
      label: `${ARABIC_MONTHS[month]} ${year}`,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

function stampCreatedBy(where: { createdBy?: string }, filters: { userId?: string }) {
  if (filters.userId) where.createdBy = String(filters.userId);
}

function postedOnly(filters: { showUnposted?: boolean }) {
  return filters.showUnposted ? {} : { isPosted: true };
}

export class ReportsService {
  /**
   * Get General Ledger report
   */
  async getGeneralLedger(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, accountId, branchId } = filters;
      const { page = 1, limit = 100, includeDetails = true } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isCancelled: false,
        deletedAt: null,
        reversalOfJournalEntryId: null,
        NOT: { entryType: 'REVERSAL' },
        ...(filters.showUnposted ? {} : { isPosted: true }),
      };

      if (accountId) {
        where.lines = {
          some: {
            accountId,
          },
        };
      }

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      stampCreatedBy(where, filters);
      const [journalEntries, total, lineTotals] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
          include: includeDetails
            ? {
                lines: {
                  include: {
                    account: {
                      select: {
                        id: true,
                        code: true,
                        arabicName: true,
                      },
                    },
                    costCenter: {
                      select: {
                        id: true,
                        code: true,
                        arabicName: true,
                      },
                    },
                  },
                  orderBy: { lineOrder: 'asc' },
                },
              }
            : undefined,
        }),
        prisma.journalEntry.count({ where }),
        prisma.journalEntryLine.aggregate({
          where: {
            journalEntry: {
              companyId,
              date: { gte: fromDate, lte: toDate },
              ...(filters.showUnposted ? {} : { isPosted: true }),
              isCancelled: false,
              ...(branchId ? { branchId } : {}),
            },
            ...(accountId ? { accountId } : {}),
          },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

      const summary = {
        totalEntries: total,
        totalDebit: Number(lineTotals._sum.debitBase || 0),
        totalCredit: Number(lineTotals._sum.creditBase || 0),
      };
      const fundBySource = await voucherFundBySourceId(
        companyId,
        journalEntries.map((entry) => entry.sourceId)
      );

      return {
        data: journalEntries.map((entry) => ({
          ...entry,
          voucherFund: entry.sourceId ? fundBySource.get(entry.sourceId) ?? null : null,
        })),
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating general ledger report');
      throw error;
    }
  }

  /**
   * Get Daily Journal report
   */
  async getDailyJournal(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;
      const accountView = parseDailyJournalAccountView(filters.accountView);
      const amountOp = parseDailyJournalAmountOp(filters.amountOp);
      const amount = parseOptionalNumber(filters.amount);
      const amountTo = parseOptionalNumber(filters.amountTo);
      const fromVoucher = parseOptionalNumber(filters.fromVoucher);
      const toVoucher = parseOptionalNumber(filters.toVoucher);
      const description = String(filters.description ?? '').trim();
      const scansEntries = Boolean(amountOp && amount != null) || fromVoucher != null || toVoucher != null;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      let accountIds: string[] | undefined;
      if (filters.accountId) {
        const accounts = await prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true },
        });
        accountIds = collectSubtreeIds(String(filters.accountId), accounts);
      }

      let currencyCode: string | undefined;
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: String(filters.currencyId), companyId },
          select: { code: true },
        });
        if (!currency) throw new Error('العملة غير موجودة');
        currencyCode = currency.code;
      }

      const lineSome: any = {};
      if (accountIds?.length) lineSome.accountId = { in: accountIds };
      if (filters.costCenterId) lineSome.costCenterId = String(filters.costCenterId);

      const where: any = {
        companyId,
        date: { gte: fromDate, lte: toDate },
        isCancelled: false,
        deletedAt: null,
        reversalOfJournalEntryId: null,
        NOT: { entryType: 'REVERSAL' },
      };
      if (branchId) where.branchId = branchId;
      if (currencyCode) where.currencyCode = currencyCode;
      if (Object.keys(lineSome).length) where.lines = { some: lineSome };
      if (description) {
        where.OR = [
          { description: { contains: description } },
          { descriptionAr: { contains: description } },
          {
            lines: {
              some: {
                ...lineSome,
                OR: [
                  { description: { contains: description } },
                  { descriptionAr: { contains: description } },
                ],
              },
            },
          },
        ];
      }

      stampCreatedBy(where, filters);
      const journalEntries = await prisma.journalEntry.findMany({
        where,
        skip: scansEntries ? 0 : (page - 1) * limit,
        take: scansEntries ? 2000 : limit,
        orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  parent: { select: { code: true, arabicName: true } },
                },
              },
              costCenter: { select: { code: true, arabicName: true } },
            },
            orderBy: { lineOrder: 'asc' },
          },
        },
      });

      const matchedEntries = journalEntries.filter((entry) => {
        if (!voucherNumberInRange(entry.voucherNumber, fromVoucher, toVoucher)) return false;
        if (amountOp && amount != null) {
          const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debitBase ?? line.debit ?? 0), 0);
          if (!amountMatches(totalDebit, amountOp, amount, amountTo)) return false;
        }
        return true;
      });

      const sourceIds = matchedEntries
        .map((entry) => entry.sourceId)
        .filter((id): id is string => Boolean(id));
      const [accountRows, sourceInvoices] = await Promise.all([
        prisma.account.findMany({
          where: { companyId },
          select: { id: true, parentId: true, code: true, arabicName: true },
        }),
        sourceIds.length
          ? prisma.invoice.findMany({
              where: { companyId, id: { in: sourceIds } },
              select: { id: true, invoiceNumber: true },
            })
          : Promise.resolve([]),
      ]);
      const accountById = new Map(accountRows.map((row) => [row.id, row]));
      const invoiceById = new Map(sourceInvoices.map((row) => [row.id, row]));
      const rootAccount = (accountId: string) => {
        let current = accountById.get(accountId);
        let top = current;
        const seen = new Set<string>();
        while (current && !seen.has(current.id)) {
          seen.add(current.id);
          top = current;
          current = current.parentId ? accountById.get(current.parentId) : undefined;
        }
        return top;
      };

      const accountIdSet = accountIds?.length ? new Set(accountIds) : null;
      const needle = description.toLowerCase();
      const fundBySource = await voucherFundBySourceId(
        companyId,
        matchedEntries.map((entry) => entry.sourceId)
      );
      const rows = matchedEntries.flatMap((entry) => {
        const headerText = `${entry.description ?? ''} ${entry.descriptionAr ?? ''}`.toLowerCase();
        const headerMatches = !needle || headerText.includes(needle);
        return entry.lines
          .filter((line) => {
            if (accountIdSet && !accountIdSet.has(line.accountId)) return false;
            if (filters.costCenterId && line.costCenterId !== String(filters.costCenterId)) return false;
            if (headerMatches || !needle) return true;
            const lineText = `${line.description ?? ''} ${line.descriptionAr ?? ''}`.toLowerCase();
            return lineText.includes(needle);
          })
          .map((line) => {
            const ledger = accountById.get(line.accountId) ?? line.account;
            const main = rootAccount(line.accountId) ?? ledger;
            const row: Record<string, unknown> = {
              date: entry.date,
              voucherNumber: entry.voucherNumber,
              sourceNumber: entry.sourceNumber || invoiceById.get(entry.sourceId ?? '')?.invoiceNumber || '',
              description: line.description || line.descriptionAr || entry.description || entry.descriptionAr || '',
            };
            if (accountView !== 'ledger') {
              row.mainAccount = accountDisplayLabel(main?.code, main?.arabicName);
            }
            if (accountView !== 'main') {
              row.ledgerAccount = accountDisplayLabel(ledger?.code, ledger?.arabicName);
            }
            row.costCenter = line.costCenter
              ? accountDisplayLabel(line.costCenter.code, line.costCenter.arabicName)
              : '';
            row.debit = Number(line.debitBase ?? line.debit ?? 0);
            row.credit = Number(line.creditBase ?? line.credit ?? 0);
            row.entryCurrency = line.currencyCode || entry.currencyCode;
            row.entryExchangeRate = Number(line.exchangeRate ?? entry.exchangeRate ?? 1);
            row.journalEntryIsApproved = journalEntryIsApprovedFlag(entry.isApproved);
            row.approvalStatus = journalApprovalStatusLabel(entry.isApproved);
            row.postingPosition = entry.isPosted ? 'مرحّل' : 'غير مرحّل';
            row.sourceType = entry.sourceType;
            row.sourceKind = entry.sourceKind;
            row.sourceId = entry.sourceId;
            row.entryType = entry.entryType;
            row.voucherFund = entry.sourceId ? fundBySource.get(entry.sourceId) ?? null : null;
            row.journalEntryId = entry.id;
            return row;
          });
      });

      const pageRows = scansEntries ? rows.slice((page - 1) * limit, page * limit) : rows;
      const total = scansEntries ? rows.length : await prisma.journalEntry.count({ where });
      const lineAgg = scansEntries
        ? null
        : await prisma.journalEntryLine.aggregate({
            where: {
              journalEntry: where,
              ...(Object.keys(lineSome).length ? lineSome : {}),
            },
            _sum: { debitBase: true, creditBase: true },
            _count: { _all: true },
          });
      const totalDebit = lineAgg
        ? Number(lineAgg._sum.debitBase || 0)
        : rows.reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
      const totalCredit = lineAgg
        ? Number(lineAgg._sum.creditBase || 0)
        : rows.reduce((sum, row) => sum + Number(row.credit ?? 0), 0);
      const lineCount = lineAgg ? lineAgg._count._all : rows.length;

      return {
        data: pageRows,
        summary: {
          totalDebit,
          totalCredit,
          lineCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating daily journal report');
      throw error;
    }
  }

  /**
   * Get Cost Center Ledger report
   */
  async getCostCenterLedger(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, costCenterId, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const lineFilter = costCenterId
        ? { costCenterId }
        : { costCenterId: { not: null } };

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedOnly(filters),
        isCancelled: false,
        lines: {
          some: lineFilter,
        },
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      stampCreatedBy(where, filters);
      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
          include: {
            lines: {
              where: lineFilter,
              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
                costCenter: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
              orderBy: { lineOrder: 'asc' },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return {
        data: journalEntries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cost center ledger report');
      throw error;
    }
  }

  /**
   * Get Account Analysis report
   */
  async getAccountAnalysis(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, accountId, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedOnly(filters),
        isCancelled: false,
        lines: {
          some: {
            accountId,
          },
        },
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      stampCreatedBy(where, filters);
      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
          include: {
            lines: {
              where: {
                accountId,
              },
              include: {
                account: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
                costCenter: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
              orderBy: { lineOrder: 'asc' },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      // Calculate opening balance (before fromDate)
      const openingLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId,
          journalEntry: {
            companyId,
            date: {
              lt: fromDate,
            },
            ...postedOnly(filters),
            isCancelled: false,
          },
        },
      });

      const openingDebit = openingLines.reduce(
        (sum, line) => sum + Number(line.debit),
        0
      );
      const openingCredit = openingLines.reduce(
        (sum, line) => sum + Number(line.credit),
        0
      );
      const openingBalance = openingDebit - openingCredit;

      // Calculate period totals
      const periodLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId,
          journalEntry: {
            ...where,
          },
        },
      });

      const periodDebit = periodLines.reduce(
        (sum, line) => sum + Number(line.debit),
        0
      );
      const periodCredit = periodLines.reduce(
        (sum, line) => sum + Number(line.credit),
        0
      );
      const closingBalance = openingBalance + periodDebit - periodCredit;

      return {
        data: journalEntries,
        summary: {
          openingBalance,
          periodDebit,
          periodCredit,
          closingBalance,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating account analysis report');
      throw error;
    }
  }

  /**
   * Get Account Movements report
   */
  async getAccountMovements(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    return this.getAccountAnalysis(filters, options);
  }

  /**
   * Get Credit Aging report.
   *
   * H19 fix: this used to run its own invoice-date-based aging query,
   * duplicating (and disagreeing with) `agedOpenItemsService` — the
   * canonical AR/AP aging report that buckets by *due* date and ties out
   * to the GL control account. It also mixed AR and AP together into one
   * bucket set whenever neither `customerId` nor `supplierId` was passed,
   * and computed its bucket `summary` only over the current pagination
   * page instead of the full matching set. This now delegates to the
   * single reconciled implementation and paginates client-side over the
   * full, correctly-summed result.
   * @deprecated Prefer `GET /accounting/reports/aged-receivables` or
   * `/aged-payables` (M16, `aged-open-items.service.ts`) directly.
   */
  async getCreditAging(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const {
        companyId,
        customerId,
        supplierId,
        branchId,
        asOfDate = new Date(),
        customerCategoryId,
        supplierCategoryId,
      } = filters;
      const { page = 1, limit = 100 } = options;

      const side: 'AR' | 'AP' =
        (supplierId || supplierCategoryId) && !(customerId || customerCategoryId) ? 'AP' : 'AR';
      const report =
        side === 'AR'
          ? await agedOpenItemsService.getAgedReceivables({
              companyId,
              branchId,
              asOfDate,
              customerId,
              customerCategoryId,
            })
          : await agedOpenItemsService.getAgedPayables({
              companyId,
              branchId,
              asOfDate,
              supplierId,
              supplierCategoryId,
            });

      const OLD_BUCKET_MAP: Record<AgingBucketKey, string> = {
        current_0_30: 'current',
        days_31_60: 'over30',
        days_61_90: 'over60',
        days_91_120: 'over90',
        days_120_plus: 'over120',
      };

      const agingData = report.lines.map((line) => ({
        invoiceId: line.invoiceId,
        invoiceNumber: line.invoiceNumber,
        date: line.date,
        dueDate: line.dueDate,
        remainingAmount: line.remainingAmount,
        netAmount: line.netAmount,
        paidAmount: line.paidAmount,
        paymentStatus: line.paymentStatus,
        currencyCode: line.currencyCode,
        customer: line.customer,
        supplier: line.supplier,
        daysPastDue: line.daysOutstanding,
        agingBucket: OLD_BUCKET_MAP[line.bucket],
      }));

      const total = agingData.length;
      const skip = (page - 1) * limit;
      const pageData = agingData.slice(skip, skip + limit);

      const summary = {
        current: report.bucketTotals.current_0_30,
        over0: 0,
        over30: report.bucketTotals.days_31_60,
        over60: report.bucketTotals.days_61_90,
        over90: report.bucketTotals.days_91_120,
        over120: report.bucketTotals.days_120_plus,
        total: report.grandTotal,
        controlAccountTieOut: report.controlAccountTieOut,
      };

      return {
        data: pageData,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating credit aging report');
      throw error;
    }
  }

  /**
   * Get Review Balance (Accounts Balance) report — delegates to {@link financialReportService.getTrialBalance}.
   * @deprecated Prefer `GET /accounting/financial-reports/trial-balance` directly.
   */
  async getReviewBalance(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      if (!toDate) {
        throw new Error('To date is required');
      }

      const fy = await prisma.fiscalYear.findFirst({
        where: {
          companyId,
          startDate: { lte: toDate },
          endDate: { gte: toDate },
        },
        orderBy: { startDate: 'desc' },
      });

      const startDate = fromDate ?? fy?.startDate ?? new Date(toDate.getFullYear(), 0, 1);

      const tb = await financialReportService.getTrialBalance({
        companyId,
        branchId,
        fiscalYearId: fy?.id,
        startDate,
        endDate: toDate,
      });

      const accountIds = tb.accounts.map((a) => a.accountId);
      const accountsMeta = await prisma.account.findMany({
        where: { id: { in: accountIds }, companyId },
        select: {
          id: true,
          code: true,
          arabicName: true,
          accountType: true,
        },
      });
      const metaById = new Map(accountsMeta.map((a) => [a.id, a]));

      const accountBalances = tb.accounts.map((row) => {
        const account = metaById.get(row.accountId);
        const typeCode = account?.accountType ?? row.accountType ?? 'OTHER';
        const debit = Number(row.periodDebit) + Number(row.openingDebit);
        const credit = Number(row.periodCredit) + Number(row.openingCredit);
        return {
          account: {
            id: row.accountId,
            code: row.code,
            arabicName: row.arabicName,
            accountType: { code: typeCode, arabicName: typeCode },
          },
          debit,
          credit,
          balance: row.closingNet,
        };
      });

      const groupedByType = accountBalances.reduce((acc: Record<string, unknown>, item: (typeof accountBalances)[0]) => {
        const typeCode = item.account.accountType?.code ?? 'OTHER';
        if (!acc[typeCode]) {
          acc[typeCode] = {
            accountType: item.account.accountType,
            accounts: [],
            totalDebit: 0,
            totalCredit: 0,
            totalBalance: 0,
          };
        }
        const bucket = acc[typeCode] as {
          accountType: unknown;
          accounts: typeof accountBalances;
          totalDebit: number;
          totalCredit: number;
          totalBalance: number;
        };
        bucket.accounts.push(item);
        bucket.totalDebit += item.debit;
        bucket.totalCredit += item.credit;
        bucket.totalBalance += item.balance;
        return acc;
      }, {});

      const summary = {
        totalAccounts: accountBalances.length,
        totalDebit: accountBalances.reduce((sum, item) => sum + item.debit, 0),
        totalCredit: accountBalances.reduce((sum, item) => sum + item.credit, 0),
        totalBalance: accountBalances.reduce((sum, item) => sum + item.balance, 0),
        trialBalanceBalanced: tb.verification.balanced,
        byAccountType: Object.values(groupedByType),
      };

      // M16 fix (Item 35): `page`/`limit` were read and echoed back in
      // `pagination`, but `data` was always the full, unsliced account list
      // — every page returned everything. `summary`/`byAccountType` still
      // total the full (unpaginated) set, matching the pattern used by
      // getPayrollReport above.
      const total = accountBalances.length;
      const skip = (page - 1) * limit;
      const pageData = accountBalances.slice(skip, skip + limit);

      return {
        data: pageData,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating review balance report');
      throw error;
    }
  }

  /**
   * Monthly trial balance: opening before the range, then gross debit/credit
   * for each calendar month inside the range, then a grand total.
   */
  async getMonthlyReviewBalance(filters: ReportFilters): Promise<ReportResult> {
    const { fromDate, toDate, companyId, branchId } = filters;
    if (!fromDate || !toDate) {
      throw new Error('يرجى اختيار تاريخ البداية والنهاية');
    }

    const monthSelects = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const debitAlias = Prisma.raw(`m${month}Debit`);
      const creditAlias = Prisma.raw(`m${month}Credit`);
      return Prisma.sql`
        COALESCE(SUM(CASE
          WHEN je.date >= ${fromDate} AND je.date <= ${toDate} AND MONTH(je.date) = ${month}
          THEN jel.debitBase ELSE 0 END), 0) AS ${debitAlias},
        COALESCE(SUM(CASE
          WHEN je.date >= ${fromDate} AND je.date <= ${toDate} AND MONTH(je.date) = ${month}
          THEN jel.creditBase ELSE 0 END), 0) AS ${creditAlias}
      `;
    });

    const branchSql = branchId ? Prisma.sql`AND je.branchId = ${branchId}` : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        a.id AS accountId,
        a.code AS code,
        a.arabicName AS arabicName,
        COALESCE(SUM(CASE WHEN je.date < ${fromDate} THEN jel.debitBase ELSE 0 END), 0) AS openingDebit,
        COALESCE(SUM(CASE WHEN je.date < ${fromDate} THEN jel.creditBase ELSE 0 END), 0) AS openingCredit,
        ${Prisma.join(monthSelects, ', ')}
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.accountId = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journalEntryId
        AND je.companyId = a.companyId
        ${filters.showUnposted ? Prisma.empty : Prisma.sql`AND je.isPosted = true`}
        AND je.isCancelled = false
        AND je.deletedAt IS NULL
        ${branchSql}
      WHERE a.companyId = ${companyId}
        AND (a.deletedAt IS NULL OR jel.id IS NOT NULL)
      GROUP BY a.id, a.code, a.arabicName
      ORDER BY a.code ASC
    `);

    const data = rows
      .map((row) => {
        const openingDebit = roundTo4(Number(row.openingDebit) || 0);
        const openingCredit = roundTo4(Number(row.openingCredit) || 0);
        let totalDebit = openingDebit;
        let totalCredit = openingCredit;
        const shaped: Record<string, unknown> = {
          accountId: row.accountId,
          code: row.code,
          account: [row.code, row.arabicName].filter(Boolean).join(' — '),
          openingDebit,
          openingCredit,
        };
        for (let month = 1; month <= 12; month += 1) {
          const debit = roundTo4(Number(row[`m${month}Debit`]) || 0);
          const credit = roundTo4(Number(row[`m${month}Credit`]) || 0);
          shaped[`m${month}Debit`] = debit;
          shaped[`m${month}Credit`] = credit;
          totalDebit = roundTo4(totalDebit + debit);
          totalCredit = roundTo4(totalCredit + credit);
        }
        shaped.totalDebit = totalDebit;
        shaped.totalCredit = totalCredit;
        return shaped;
      })
      .filter(
        (row) =>
          filters.showIdleAccounts || Number(row.totalDebit) !== 0 || Number(row.totalCredit) !== 0
      );

    const summary = {
      totalAccounts: data.length,
      totalDebit: roundTo4(data.reduce((sum, row) => sum + Number(row.totalDebit), 0)),
      totalCredit: roundTo4(data.reduce((sum, row) => sum + Number(row.totalCredit), 0)),
    };

    return {
      data,
      summary,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    };
  }

  /**
   * موازنة مراكز التكلفة — same columns as the account budget, one posting center per row.
   */
  async getCostCentersBalance(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, costCenterId, currencyId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      const periodStart = fromDate ?? new Date(new Date().getFullYear(), 0, 1);
      const periodEnd = toDate ?? new Date();
      const currencyCode = await currencyCodeFor(companyId, currencyId ? String(currencyId) : undefined);

      const tree = await prisma.costCenter.findMany({
        where: { companyId },
        select: { id: true, parentId: true, code: true, arabicName: true, budget: true, costCenterKind: true },
      });
      const centerIds = costCenterId ? collectSubtreeIds(String(costCenterId), tree) : undefined;
      const postedEntry = {
        companyId,
        ...postedOnly(filters),
        isCancelled: false,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
      };
      const centerScope = centerIds ? { in: centerIds } : { not: null };

      const [openingGroups, periodGroups] = await Promise.all([
        prisma.journalEntryLine.groupBy({
          by: ['costCenterId'],
          where: { costCenterId: centerScope, journalEntry: { ...postedEntry, date: { lt: periodStart } } },
          _sum: { debitBase: true, creditBase: true },
        }),
        prisma.journalEntryLine.groupBy({
          by: ['costCenterId'],
          where: {
            costCenterId: centerScope,
            journalEntry: { ...postedEntry, date: { gte: periodStart, lte: periodEnd } },
          },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

      const openingByCenter = new Map(openingGroups.map((row) => [row.costCenterId, row._sum]));
      const periodByCenter = new Map(periodGroups.map((row) => [row.costCenterId, row._sum]));
      const rows = buildCostCenterBudgetRows(
        tree
          .filter((center) => center.costCenterKind === 'POSTING' && (!centerIds || centerIds.includes(center.id)))
          .sort((a, b) => a.code.localeCompare(b.code, 'ar'))
          .map((center) => {
            const opening = openingByCenter.get(center.id);
            const period = periodByCenter.get(center.id);
            return {
              id: center.id,
              code: center.code,
              arabicName: center.arabicName,
              parentId: center.parentId,
              budget: Number(center.budget || 0),
              openingDebit: Number(opening?.debitBase || 0),
              openingCredit: Number(opening?.creditBase || 0),
              periodDebit: Number(period?.debitBase || 0),
              periodCredit: Number(period?.creditBase || 0),
            };
          }),
        tree
      );
      const visible = filters.withBudgetOnly ? rows.filter((row) => row.budgetValue > 0) : rows;

      const total = visible.length;
      return {
        data: visible.slice((page - 1) * limit, page * limit),
        summary: {
          totalAccounts: total,
          totalBudget: visible.reduce((sum, row) => sum + row.budgetValue, 0),
          totalActual: visible.reduce((sum, row) => sum + row.actual, 0),
          totalVariance: visible.reduce((sum, row) => sum + row.variance, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cost center budget report');
      throw error;
    }
  }

  /**
   * Get Trading Account report.
   *
   * Posted journals on sales and cost-of-sales accounts are included, whether
   * the line came from an invoice or from a manual journal. Administrative
   * expenses stay on the income statement.
   */
  async getTradingAccount(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId, costCenterId } = filters;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const journalWhere = {
        companyId,
        ...postedOnly(filters),
        isCancelled: false,
        date: { gte: fromDate, lte: toDate },
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      };

      const centerIds = await costCenterIdsFor(companyId, costCenterId ? String(costCenterId) : undefined);
      const [accounts, movements] = await Promise.all([
        prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            parentId: true,
            code: true,
            arabicName: true,
            accountType: true,
            accountNature: true,
            statementType: true,
          },
          orderBy: { code: 'asc' },
        }),
        prisma.journalEntryLine.groupBy({
          by: ['accountId'],
          where: {
            journalEntry: journalWhere,
            ...(centerIds ? { costCenterId: { in: centerIds } } : {}),
          },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

      type Acc = (typeof accounts)[number];
      const byId = new Map(accounts.map((account) => [account.id, account]));
      const childrenByParent = new Map<string, string[]>();
      for (const account of accounts) {
        if (!account.parentId) continue;
        const bucket = childrenByParent.get(account.parentId) ?? [];
        bucket.push(account.id);
        childrenByParent.set(account.parentId, bucket);
      }
      const sectionIds = new Set<string>();
      const queue = accounts.filter((account) => isTradingStatementAccount(account)).map((account) => account.id);
      while (queue.length) {
        const id = queue.shift()!;
        if (sectionIds.has(id)) continue;
        sectionIds.add(id);
        for (const childId of childrenByParent.get(id) ?? []) queue.push(childId);
      }
      const tradingIds = sectionIds;

      const sideOf = (account: Acc): 'debit' | 'credit' => {
        const cls = classifyAccount(account.code, account.accountType);
        if (cls === 'REVENUE') return 'credit';
        if (cls === 'COGS' || cls === 'EXPENSE') return 'debit';
        const kind = (account.accountType ?? '').toLowerCase();
        if (kind.includes('إيراد') || kind.includes('revenue')) return 'credit';
        if (account.accountNature === 'CREDIT') return 'credit';
        return 'debit';
      };

      const direct = new Map<string, number>();
      for (const row of movements) {
        const account = byId.get(row.accountId);
        if (!account || !tradingIds.has(account.id)) continue;
        const debit = Number(row._sum.debitBase ?? 0);
        const credit = Number(row._sum.creditBase ?? 0);
        const natural = sideOf(account) === 'credit' ? credit - debit : debit - credit;
        direct.set(account.id, roundTo4(natural));
      }

      const children = new Map<string, Acc[]>();
      for (const account of accounts) {
        if (!tradingIds.has(account.id) || !account.parentId || !tradingIds.has(account.parentId)) continue;
        const parent = byId.get(account.parentId);
        if (!parent || sideOf(parent) !== sideOf(account)) continue;
        const bucket = children.get(account.parentId) ?? [];
        bucket.push(account);
        children.set(account.parentId, bucket);
      }
      for (const bucket of children.values()) {
        bucket.sort((a, b) => a.code.localeCompare(b.code, 'ar'));
      }

      const rolled = new Map<string, number>();
      const roll = (id: string): number => {
        const cached = rolled.get(id);
        if (cached != null) return cached;
        let sum = direct.get(id) ?? 0;
        for (const child of children.get(id) ?? []) sum = roundTo4(sum + roll(child.id));
        rolled.set(id, sum);
        return sum;
      };
      for (const id of tradingIds) roll(id);

      type SheetRow = { code: string; arabicName: string; amount: number; depth: number };
      const flatten = (account: Acc, depth: number): SheetRow[] => {
        const nested = (children.get(account.id) ?? []).flatMap((child) => flatten(child, depth + 1));
        const amount = rolled.get(account.id) ?? 0;
        if (amount === 0 && nested.length === 0) return [];
        return [{ code: account.code, arabicName: account.arabicName, amount, depth }, ...nested];
      };

      const roots = accounts
        .filter((account) => {
          if (!tradingIds.has(account.id)) return false;
          const parent = account.parentId ? byId.get(account.parentId) : undefined;
          return !parent || !tradingIds.has(parent.id) || sideOf(parent) !== sideOf(account);
        })
        .sort((a, b) => a.code.localeCompare(b.code, 'ar'));

      const debit = roots.filter((account) => sideOf(account) === 'debit').flatMap((account) => flatten(account, 0));
      const credit = roots.filter((account) => sideOf(account) === 'credit').flatMap((account) => flatten(account, 0));

      const sumRoots = (rows: SheetRow[]) =>
        roundTo4(rows.reduce((sum, row) => (row.depth === 0 ? sum + row.amount : sum), 0));
      const totalDebit = sumRoots(debit);
      const totalCredit = sumRoots(credit);
      const grossProfit = roundTo4(totalCredit - totalDebit);
      const grandTotal = roundTo4(Math.max(totalDebit, totalCredit));

      const label = (row: SheetRow) => [row.code, row.arabicName].filter(Boolean).join(' ');
      const data = [
        ...debit.map((row) => ({ side: 'مدين', account: label(row), amount: row.amount, depth: row.depth })),
        ...credit.map((row) => ({ side: 'دائن', account: label(row), amount: row.amount, depth: row.depth })),
      ];

      return {
        data,
        summary: {
          totalDebit,
          totalCredit,
          grossProfit,
          endingInventory: 0,
          grandTotal,
          sheet: { debit, credit },
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating trading account report');
      throw error;
    }
  }

  /**
   * Get Bank Movement report.
   *
   * M16 fix: `accountType` is a scalar column, not a relation, so
   * `accountType: { code: 'BANK' }` threw a Prisma validation error at
   * runtime (endpoint was completely broken). There is also no
   * `accountType === 'BANK'` convention anywhere else in the codebase — the
   * canonical way to find bank GL accounts is via `BankAccount.glAccountId`
   * (same resolver `financialReportService` uses for cash-flow/aging).
   */
  async getBankMovement(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, accountId, branchId, currencyId } = filters;
      const { page = 1, limit = 5000 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }
      const money = await reportMoneyContext(companyId, currencyId ? String(currencyId) : undefined);
      const banks = await prisma.bankAccount.findMany({
        where: {
          companyId,
          glAccountId: { not: null },
          ...(accountId
            ? {
                OR: [
                  { glAccountId: String(accountId) },
                  { glAccount: { parentId: String(accountId) } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          arabicName: true,
          code: true,
          glAccountId: true,
          glAccount: { select: { parentId: true } },
        },
        orderBy: { code: 'asc' },
      });
      const funds = banks.map((bank) => ({
        id: bank.id,
        arabicName: bank.arabicName,
        code: bank.code,
        glAccountId: bank.glAccountId,
        parentAccountId: bank.glAccount?.parentId ?? null,
      }));
      const accountIds = [
        ...new Set(
          funds.flatMap((bank) => [bank.glAccountId, bank.parentAccountId].filter((id): id is string => Boolean(id)))
        ),
      ];
      const lines = await postedFundLedgerLines(companyId, accountIds, money, {
        branchId: branchId ? String(branchId) : undefined,
        toDate,
        userId: filters.userId ? String(filters.userId) : undefined,
        includeUnposted: Boolean(filters.showUnposted),
      });
      const built = buildSafeMovementRows({
        safes: funds,
        lines,
        fromDate,
        currencyCode: money.reportCurrency,
        openingLabel: 'رصيد سابق',
        fundField: 'bankAccount',
      });
      const pageStart = (page - 1) * limit;
      const total = built.rows.length;

      return {
        data: built.rows.slice(pageStart, pageStart + limit),
        summary: {
          previousBalance: built.summary.openingBalance,
          totalReceipts: built.summary.totalReceipts,
          totalPayments: built.summary.totalPayments,
          closingBalance: built.summary.closingBalance,
          currencyCode: money.reportCurrency,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating bank movement report');
      throw error;
    }
  }

  async getBankMonthlyStatement(filters: ReportFilters): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, accountId, branchId } = filters;
      if (!fromDate || !toDate) throw new Error('From date and to date are required');

      const money = await reportMoneyContext(companyId, filters.currencyId ? String(filters.currencyId) : undefined);

      const banks = await prisma.bankAccount.findMany({
        where: {
          companyId,
          isActive: true,
          glAccountId: accountId ? String(accountId) : { not: null },
        },
        select: { id: true, arabicName: true, glAccountId: true },
        orderBy: { arabicName: 'asc' },
      });

      const months = listMonths(fromDate, toDate);
      const statements = [];

      for (const bank of banks) {
        if (!bank.glAccountId) continue;
        for (const month of months) {
          const entryWhere = {
            companyId,
            ...postedOnly(filters),
            isCancelled: false,
            deletedAt: null,
            ...(branchId ? { branchId } : {}),
            ...(filters.userId ? { createdBy: String(filters.userId) } : {}),
          };
          const [openingAgg, lines] = await Promise.all([
            prisma.journalEntryLine.aggregate({
              where: {
                accountId: bank.glAccountId,
                journalEntry: { ...entryWhere, date: { lt: month.start } },
              },
              _sum: { debitBase: true, creditBase: true },
            }),
            prisma.journalEntryLine.findMany({
              where: {
                accountId: bank.glAccountId,
                journalEntry: { ...entryWhere, date: { gte: month.start, lte: month.end } },
              },
              orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
              select: {
                debit: true,
                credit: true,
                debitBase: true,
                creditBase: true,
                currencyCode: true,
                exchangeRate: true,
                description: true,
                descriptionAr: true,
                journalEntry: {
                  select: {
                    date: true,
                    description: true,
                    descriptionAr: true,
                    id: true,
                    voucherNumber: true,
                    sourceNumber: true,
                    sourceType: true,
                    sourceKind: true,
                    sourceId: true,
                    entryType: true,
                  },
                },
              },
            }),
          ]);

          const opening = convertedAmount(money, {
            face: Number(openingAgg._sum.debitBase ?? 0) - Number(openingAgg._sum.creditBase ?? 0),
            base: Number(openingAgg._sum.debitBase ?? 0) - Number(openingAgg._sum.creditBase ?? 0),
            currencyCode: money.companyBase,
            exchangeRate: 1,
          });
          const receipts = [];
          const payments = [];
          for (const line of lines) {
            const debit = convertedAmount(money, {
              face: Number(line.debit || 0),
              base: Number(line.debitBase || 0),
              currencyCode: line.currencyCode,
              exchangeRate: Number(line.exchangeRate ?? 1),
            });
            const credit = convertedAmount(money, {
              face: Number(line.credit || 0),
              base: Number(line.creditBase || 0),
              currencyCode: line.currencyCode,
              exchangeRate: Number(line.exchangeRate ?? 1),
            });
            const entry = line.journalEntry;
            const row = {
              date: entry.date,
              amount: debit > 0 ? debit : credit,
              description: line.description || line.descriptionAr || entry.description || entry.descriptionAr || '',
              origin: bankMovementOrigin(
                entry.sourceType,
                entry.sourceKind,
                debit > 0 ? 'in' : 'out',
                entry.entryType
              ),
              number: entry.voucherNumber || entry.sourceNumber || '',
              journalEntryId: entry.id,
              sourceId: entry.sourceId,
              sourceType: entry.sourceType,
              sourceKind: entry.sourceKind,
              entryType: entry.entryType,
            };
            if (debit > 0) receipts.push(row);
            else if (credit > 0) payments.push(row);
          }
          const receiptsTotal = receipts.reduce((sum, row) => sum + row.amount, 0);
          const paymentsTotal = payments.reduce((sum, row) => sum + row.amount, 0);
          const closing = opening + receiptsTotal - paymentsTotal;
          statements.push({
            bankName: bank.arabicName,
            monthLabel: month.label,
            opening,
            receiptsTotal,
            paymentsTotal,
            gross: opening + receiptsTotal,
            closing: closing > 0 ? closing : 0,
            overdraft: closing < 0 ? Math.abs(closing) : 0,
            receipts,
            payments,
          });
        }
      }

      return { data: statements };
    } catch (error) {
      logger.error({ error, filters }, 'Error generating bank monthly statement');
      throw error;
    }
  }

  /**
   * Get Unposted Operations report
   */
  async getUnpostedOperations(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId, accountId, costCenterId } = filters;
      const { page = 1, limit = 100 } = options;
      const lineWhere = await journalLineMatch(companyId, accountId, costCenterId);

      const where: Prisma.JournalEntryWhereInput = {
        companyId,
        isPosted: false,
        isCancelled: false,
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      if (branchId) {
        where.branchId = branchId;
      }
      if (lineWhere) where.lines = { some: lineWhere };

      const skip = (page - 1) * limit;

      stampCreatedBy(where, filters);
      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            lines: {
              where: lineWhere,
              include: journalLineInclude,
              orderBy: { lineOrder: 'asc' },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return {
        data: journalEntries,
        summary: {
          totalUnposted: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating unposted operations report');
      throw error;
    }
  }

  async getCancelledOperations(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId, accountId, costCenterId } = filters;
      const { page = 1, limit = 100 } = options;
      const lineWhere = await journalLineMatch(companyId, accountId, costCenterId);

      const where: Prisma.JournalEntryWhereInput = {
        companyId,
        isCancelled: true,
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }
      if (branchId) where.branchId = branchId;
      if (lineWhere) where.lines = { some: lineWhere };

      const skip = (page - 1) * limit;
      stampCreatedBy(where, filters);
      const [entries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            lines: {
              where: lineWhere,
              include: journalLineInclude,
              orderBy: { lineOrder: 'asc' },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return {
        data: entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cancelled operations report');
      throw error;
    }
  }

  /**
   * Get Suppliers Balances report.
   *
   * M16 fix (N+1): this used to run two `findMany` queries *per supplier*
   * (invoices + treasury payments) inside a `Promise.all(suppliers.map(...))`
   * loop — O(2N) queries for N suppliers, with no upper bound since the
   * per-page supplier list still triggered unbounded per-supplier invoice/
   * payment scans. It also derived "balance" from lifetime
   * `invoice.totalAmount` minus lifetime payments instead of
   * `remainingAmount`, so it silently disagreed with every other AP report
   * (same root cause as H19's aging consolidation). Now delegates to
   * `agedOpenItemsService.getAgedPayables` — one GL-reconciled query set —
   * and derives purchases/payments from each open invoice's own
   * `netAmount`/`paidAmount`.
   */
  async getSuppliersBalances(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, supplierId, branchId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;

      const report = await agedOpenItemsService.getAgedPayables({
        companyId,
        branchId,
        supplierId,
        supplierCategoryId: filters.supplierCategoryId,
        asOfDate: asOfDate ?? new Date(),
      });

      const supplierBalances = report.parties.map((party) => ({
        supplier: {
          id: party.partyId,
          code: party.partyCode,
          arabicName: party.partyName,
        },
        totalPurchases: roundTo4(party.invoices.reduce((sum, i) => sum + i.netAmount, 0)),
        totalPayments: roundTo4(party.invoices.reduce((sum, i) => sum + i.paidAmount, 0)),
        balance: roundTo4(party.total),
      }));

      const total = supplierBalances.length;
      const skip = (page - 1) * limit;
      const pageData = supplierBalances.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalSuppliers: total,
          totalBalances: roundTo4(report.grandTotal),
          controlAccountTieOut: report.controlAccountTieOut,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating suppliers balances report');
      throw error;
    }
  }


  /**
   * Get Cost Center Balance (Single Cost Center)
   */
  async getCostCenterBalance(filters: ReportFilters, _options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, costCenterId, toDate, branchId } = filters;
      const asOf = toDate || new Date();

      let costCenterIds: string[] | undefined;
      if (costCenterId) {
        const centers = await prisma.costCenter.findMany({
          where: { companyId },
          select: { id: true, parentId: true },
        });
        if (!centers.some((center) => center.id === costCenterId)) {
          return {
            data: [],
            summary: { centers: [], totalAccounts: 0 },
            pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
          };
        }
        costCenterIds = collectSubtreeIds(costCenterId, centers);
      }
      if (filters.withBudgetOnly) {
        const budgeted = await prisma.costCenter.findMany({
          where: {
            companyId,
            budget: { gt: 0 },
            ...(costCenterIds ? { id: { in: costCenterIds } } : {}),
          },
          select: { id: true },
        });
        costCenterIds = budgeted.map((center) => center.id);
        if (!costCenterIds.length) {
          return {
            data: [],
            summary: { centers: [], totalAccounts: 0, totalByCenter: {} },
            pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
          };
        }
      }

      let accountIds: string[] | undefined;
      if (filters.accountId) {
        const accounts = await prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true },
        });
        accountIds = collectSubtreeIds(String(filters.accountId), accounts);
      }
      if (filters.withBudgetOnly) {
        const budgetedAccounts = await prisma.account.findMany({
          where: {
            companyId,
            deletedAt: null,
            budget: { gt: 0 },
            ...(accountIds ? { id: { in: accountIds } } : {}),
          },
          select: { id: true },
        });
        accountIds = budgetedAccounts.map((account) => account.id);
        if (!accountIds.length) {
          return {
            data: [],
            summary: { centers: [], totalAccounts: 0, totalByCenter: {} },
            pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
          };
        }
      }

      const centerSql = costCenterIds?.length
        ? Prisma.sql`AND jel.costCenterId IN (${Prisma.join(costCenterIds)})`
        : Prisma.empty;
      const accountSql = accountIds?.length
        ? Prisma.sql`AND a.id IN (${Prisma.join(accountIds)})`
        : Prisma.empty;
      const branchSql = branchId ? Prisma.sql`AND je.branchId = ${branchId}` : Prisma.empty;

      const grouped = await prisma.$queryRaw<
        Array<{
          accountId: string;
          code: string;
          arabicName: string;
          costCenterId: string;
          centerCode: string | null;
          centerName: string | null;
          debit: unknown;
          credit: unknown;
        }>
      >(Prisma.sql`
        SELECT
          a.id AS accountId,
          a.code AS code,
          a.arabicName AS arabicName,
          jel.costCenterId AS costCenterId,
          cc.code AS centerCode,
          cc.arabicName AS centerName,
          COALESCE(SUM(jel.debitBase), 0) AS debit,
          COALESCE(SUM(jel.creditBase), 0) AS credit
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.journalEntryId
        INNER JOIN accounts a ON a.id = jel.accountId AND a.companyId = je.companyId
        INNER JOIN cost_centers cc ON cc.id = jel.costCenterId AND cc.companyId = je.companyId
        WHERE je.companyId = ${companyId}
          ${filters.showUnposted ? Prisma.empty : Prisma.sql`AND je.isPosted = true`}
          AND je.isCancelled = false
          AND je.deletedAt IS NULL
          AND je.date <= ${asOf}
          AND jel.costCenterId IS NOT NULL
          ${branchSql}
          ${centerSql}
          ${accountSql}
        GROUP BY a.id, a.code, a.arabicName, jel.costCenterId, cc.code, cc.arabicName
        ORDER BY a.code ASC, cc.code ASC
      `);

      const centers: Array<{ id: string; code: string; name: string }> = [];
      const seenCenters = new Set<string>();
      const byAccount = new Map<
        string,
        {
          accountId: string;
          code: string;
          account: string;
          cells: Record<string, { debit: number; credit: number; balance: number }>;
        }
      >();

      for (const row of grouped) {
        const debit = roundTo4(Number(row.debit));
        const credit = roundTo4(Number(row.credit));
        if (!seenCenters.has(row.costCenterId)) {
          seenCenters.add(row.costCenterId);
          centers.push({
            id: row.costCenterId,
            code: row.centerCode ?? '',
            name: row.centerName || row.centerCode || row.costCenterId,
          });
        }
        const current = byAccount.get(row.accountId) ?? {
          accountId: row.accountId,
          code: row.code,
          account: row.arabicName,
          cells: {},
        };
        current.cells[row.costCenterId] = { debit, credit, balance: roundTo4(debit - credit) };
        byAccount.set(row.accountId, current);
      }

      centers.sort((a, b) => a.code.localeCompare(b.code, 'ar'));
      const data = [...byAccount.values()].sort((a, b) => a.code.localeCompare(b.code, 'ar'));
      const totalByCenter: Record<string, { debit: number; credit: number; balance: number }> = {};
      for (const center of centers) {
        const debit = roundTo4(data.reduce((sum, row) => sum + (row.cells[center.id]?.debit ?? 0), 0));
        const credit = roundTo4(data.reduce((sum, row) => sum + (row.cells[center.id]?.credit ?? 0), 0));
        totalByCenter[center.id] = { debit, credit, balance: roundTo4(debit - credit) };
      }

      return {
        data,
        summary: { centers, totalByCenter, totalAccounts: data.length },
        pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
      };
    } catch (error) {
      logger.error({ error, filters }, 'Error generating cost center balance report');
      throw error;
    }
  }

  /**
   * Get Budget Report
   */
  async getBudgetReport(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, accountId, costCenterId, currencyId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      const periodStart = fromDate ?? new Date(new Date().getFullYear(), 0, 1);
      const periodEnd = toDate ?? new Date();

      let accountIds: string[] | undefined;
      if (accountId) {
        const tree = await prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true },
        });
        accountIds = collectSubtreeIds(accountId, tree);
      }

      let currencyCode: string | undefined;
      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: String(currencyId), companyId },
          select: { code: true },
        });
        currencyCode = currency?.code;
      }
      const centerIds = await costCenterIdsFor(companyId, costCenterId);

      const postedEntry = {
        companyId,
        ...postedOnly(filters),
        isCancelled: false,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
      };
      const lineScope = {
        ...(accountIds ? { accountId: { in: accountIds } } : { account: { companyId } }),
        ...(centerIds ? { costCenterId: { in: centerIds } } : {}),
      };

      const [accounts, tree, openingGroups, periodGroups, companyPeriodGroups, selectedCenter] = await Promise.all([
        prisma.account.findMany({
          where: {
            companyId,
            isActive: true,
            deletedAt: null,
            accountKind: 'POSTING',
            ...(accountIds ? { id: { in: accountIds } } : {}),
          },
          select: {
            id: true,
            code: true,
            arabicName: true,
            accountType: true,
            accountNature: true,
            parentId: true,
            budget: true,
          },
          orderBy: { code: 'asc' },
        }),
        prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true, code: true, arabicName: true },
        }),
        prisma.journalEntryLine.groupBy({
          by: ['accountId'],
          where: { ...lineScope, journalEntry: { ...postedEntry, date: { lt: periodStart } } },
          _sum: { debitBase: true, creditBase: true },
        }),
        prisma.journalEntryLine.groupBy({
          by: ['accountId'],
          where: { ...lineScope, journalEntry: { ...postedEntry, date: { gte: periodStart, lte: periodEnd } } },
          _sum: { debitBase: true, creditBase: true },
        }),
        centerIds
          ? prisma.journalEntryLine.groupBy({
              by: ['accountId'],
              where: {
                ...(accountIds ? { accountId: { in: accountIds } } : { account: { companyId } }),
                journalEntry: { ...postedEntry, date: { gte: periodStart, lte: periodEnd } },
              },
              _sum: { debitBase: true, creditBase: true },
            })
          : Promise.resolve([]),
        costCenterId
          ? prisma.costCenter.findFirst({
              where: { id: costCenterId, companyId },
              select: { budget: true },
            })
          : Promise.resolve(null),
      ]);

      const byId = new Map(tree.map((account) => [account.id, account]));
      const openingByAccount = new Map(openingGroups.map((row) => [row.accountId, row._sum]));
      const periodByAccount = new Map(periodGroups.map((row) => [row.accountId, row._sum]));
      const companyByAccount = new Map(companyPeriodGroups.map((row) => [row.accountId, row._sum]));
      const className: Record<string, string> = {
        ASSET: 'أصول',
        LIABILITY: 'خصوم',
        EQUITY: 'حقوق ملكية',
        REVENUE: 'إيرادات',
        COGS: 'تكلفة المبيعات',
        EXPENSE: 'مصروفات',
        OTHER: 'أخرى',
      };

      const rows = accounts.flatMap((account) => {
        const opening = openingByAccount.get(account.id);
        const period = periodByAccount.get(account.id);
        const companyPeriod = companyByAccount.get(account.id);
        const openingDebit = roundTo4(Number(opening?.debitBase || 0));
        const openingCredit = roundTo4(Number(opening?.creditBase || 0));
        const periodDebit = roundTo4(Number(period?.debitBase || 0));
        const periodCredit = roundTo4(Number(period?.creditBase || 0));
        const budgetValue = roundTo4(Number(account.budget || 0));
        if (!budgetValue && !openingDebit && !openingCredit && !periodDebit && !periodCredit) return [];

        const cls = classifyAccount(account.code, account.accountType);
        const creditNature = account.accountNature === 'CREDIT' || cls === 'REVENUE' || cls === 'LIABILITY' || cls === 'EQUITY';
        const budgetDebit = creditNature ? 0 : budgetValue;
        const budgetCredit = creditNature ? budgetValue : 0;
        const ending = splitTrialBalanceColumns(openingDebit - openingCredit + periodDebit - periodCredit);
        const actual = creditNature ? periodCredit - periodDebit : periodDebit - periodCredit;
        const remaining = roundTo4(budgetValue - actual);
        const negativeVariance = roundTo4(Math.max(budgetValue - actual < 0 ? actual - budgetValue : 0, 0));
        const remainingPercent = budgetValue ? roundTo4((remaining / budgetValue) * 100) : 0;
        const variancePercent = budgetValue ? roundTo4((negativeVariance / budgetValue) * 100) : 0;
        const companyActual = creditNature
          ? Number(companyPeriod?.creditBase || 0) - Number(companyPeriod?.debitBase || 0)
          : Number(companyPeriod?.debitBase || 0) - Number(companyPeriod?.creditBase || 0);
        const totalBase = centerIds ? companyActual : actual;
        const totalNegative = Math.max(budgetValue - totalBase < 0 ? totalBase - budgetValue : 0, 0);
        const totalVariancePercent = budgetValue ? roundTo4((totalNegative / budgetValue) * 100) : 0;
        const centerBudget = roundTo4(Number(selectedCenter?.budget || 0));
        const centerVariancePercent = centerIds
          ? centerBudget
            ? roundTo4((Math.max(actual - centerBudget, 0) / centerBudget) * 100)
            : variancePercent
          : variancePercent;

        const pathParts: string[] = [];
        let depth = 1;
        let cursor = byId.get(account.id);
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          pathParts.unshift(cursor.arabicName);
          cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
          if (cursor) depth += 1;
        }

        return [{
          accountId: account.id,
          accountPath: pathParts.join(' › '),
          code: account.code,
          account: account.arabicName,
          classification: className[cls] ?? account.accountType ?? 'أخرى',
          budgetLevel: depth,
          budgetDebit,
          budgetCredit,
          openingDebit,
          openingCredit,
          endingDebit: ending.endingDebit,
          endingCredit: ending.endingCredit,
          remaining,
          negativeVariance,
          remainingPercent,
          variancePercent,
          centerVariancePercent,
          totalVariancePercent,
          budgetValue,
          actual: roundTo4(actual),
          variance: roundTo4(actual - budgetValue),
        }];
      });

      const total = rows.length;
      return {
        data: rows.slice((page - 1) * limit, page * limit),
        summary: {
          totalAccounts: total,
          totalBudget: rows.reduce((sum, row) => sum + row.budgetValue, 0),
          totalActual: rows.reduce((sum, row) => sum + row.actual, 0),
          totalVariance: rows.reduce((sum, row) => sum + row.variance, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating budget report');
      throw error;
    }
  }

  /**
   * Get Expenses Analysis Report
   */
  async getExpensesAnalysis(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, accountId, costCenterId, branchId, currencyId } = filters;
      const { page = 1, limit = 1000 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      let accountIds: string[] | undefined;
      if (accountId) {
        const tree = await prisma.account.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true, parentId: true },
        });
        accountIds = collectSubtreeIds(accountId, tree);
      }

      let currencyCode: string | undefined;
      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: String(currencyId), companyId },
          select: { code: true },
        });
        currencyCode = currency?.code;
      }

      const chart = await prisma.account.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(accountIds ? { id: { in: accountIds } } : {}),
        },
        select: { id: true, code: true, accountType: true },
      });
      const expenseAccountIds = chart
        .filter((account) => {
          const cls = classifyAccount(account.code ?? '', account.accountType);
          return cls === 'EXPENSE' || cls === 'COGS';
        })
        .map((account) => account.id);
      const journalWhere = {
        companyId,
        date: { gte: fromDate, lte: toDate },
        ...postedOnly(filters),
        isCancelled: false,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
      };
      const centerIds = await costCenterIdsFor(companyId, costCenterId);
      const expenseWhere = {
        accountId: { in: expenseAccountIds },
        ...(centerIds ? { costCenterId: { in: centerIds } } : {}),
        OR: [{ debitBase: { not: 0 } }, { creditBase: { not: 0 } }],
        journalEntry: journalWhere,
      };
      if (!expenseAccountIds.length) {
        return {
          data: [],
          summary: {
            supportedDebit: 0,
            supportedCredit: 0,
            unsupportedDebit: 0,
            unsupportedCredit: 0,
            unsupportedPercent: 0,
          },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      const [lines, total, supportedAgg, unsupportedAgg] = await Promise.all([
        prisma.journalEntryLine.findMany({
          where: expenseWhere,
          include: {
            account: { select: { id: true, code: true, arabicName: true, accountType: true } },
            costCenter: { select: { code: true, arabicName: true } },
            journalEntry: {
              select: {
                id: true,
                date: true,
                voucherNumber: true,
                legacyGlNum: true,
                description: true,
                sourceType: true,
                sourceKind: true,
                sourceId: true,
                sourceNumber: true,
                entryType: true,
                isApproved: true,
              },
            },
          },
          orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.journalEntryLine.count({ where: expenseWhere }),
        prisma.journalEntryLine.aggregate({
          where: { ...expenseWhere, journalEntry: { ...journalWhere, isApproved: true } },
          _sum: { debitBase: true, creditBase: true },
        }),
        prisma.journalEntryLine.aggregate({
          where: { ...expenseWhere, journalEntry: { ...journalWhere, isApproved: false } },
          _sum: { debitBase: true, creditBase: true },
        }),
      ]);

      const fundBySource = await voucherFundBySourceId(
        companyId,
        lines.map((line) => line.journalEntry?.sourceId)
      );
      const pageRows = lines.map((line) => {
        const debit = roundTo4(Number(line.debitBase || 0));
        const credit = roundTo4(Number(line.creditBase || 0));
        const entry = line.journalEntry;
        const supported = journalEntryIsApprovedFlag(entry?.isApproved);
        return {
          entryDate: entry?.date,
          account: accountDisplayLabel(line.account?.code, line.account?.arabicName),
          debit,
          credit,
          description: line.description || entry?.description || '',
          documentNumber: entry?.legacyGlNum || entry?.voucherNumber || '',
          sourceType: entry?.sourceType,
          sourceKind: entry?.sourceKind,
          sourceId: entry?.sourceId,
          entryType: entry?.entryType,
          voucherFund: entry?.sourceId ? fundBySource.get(entry.sourceId) ?? null : null,
          sourceNumber: entry?.sourceNumber || '',
          costCenterName: line.costCenter
            ? accountDisplayLabel(line.costCenter.code, line.costCenter.arabicName)
            : '',
          journalEntryIsApproved: supported,
          supportStatus: journalApprovalStatusLabel(entry?.isApproved),
          journalEntryId: entry?.id,
        };
      });

      const supportedDebit = Number(supportedAgg._sum.debitBase || 0);
      const supportedCredit = Number(supportedAgg._sum.creditBase || 0);
      const unsupportedDebit = Number(unsupportedAgg._sum.debitBase || 0);
      const unsupportedCredit = Number(unsupportedAgg._sum.creditBase || 0);
      const debitBase = supportedDebit + unsupportedDebit;

      return {
        data: pageRows,
        summary: {
          supportedDebit: roundTo4(supportedDebit),
          supportedCredit: roundTo4(supportedCredit),
          unsupportedDebit: roundTo4(unsupportedDebit),
          unsupportedCredit: roundTo4(unsupportedCredit),
          unsupportedPercent: debitBase ? roundTo4((unsupportedDebit / debitBase) * 100) : 0,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating expenses analysis report');
      throw error;
    }
  }

  /**
   * Get Operations Analysis Report
   */
  async getOperationsAnalysis(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedOnly(filters),
        isCancelled: false,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      };

      stampCreatedBy(where, filters);
      const journalEntries = await prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
              costCenter: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const fundBySource = await voucherFundBySourceId(
        companyId,
        journalEntries.map((entry) => entry.sourceId)
      );
      const operations = journalEntries.map((entry) => ({
        date: entry.date,
        journalEntryId: entry.id,
        voucherNumber: entry.voucherNumber,
        description: entry.description,
        sourceType: entry.sourceType,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        entryType: entry.entryType,
        voucherFund: entry.sourceId ? fundBySource.get(entry.sourceId) ?? null : null,
        sourceNumber: entry.sourceNumber,
        totalDebit: entry.lines.reduce((sum, line) => sum + Number(line.debitBase || 0), 0),
        totalCredit: entry.lines.reduce((sum, line) => sum + Number(line.creditBase || 0), 0),
      }));

      const sortedData = operations
        .sort((a, b) => b.totalDebit - a.totalDebit)
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalOperations: operations.length,
          totalDebit: operations.reduce((sum, op) => sum + op.totalDebit, 0),
          totalCredit: operations.reduce((sum, op) => sum + op.totalCredit, 0),
        },
        pagination: {
          page,
          limit,
          total: operations.length,
          totalPages: Math.ceil(operations.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating operations analysis report');
      throw error;
    }
  }

  /**
   * Get Account Balances (Credit section)
   */
  async getAccountBalancesCredit(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const {
        companyId,
        fromDate,
        toDate,
        accountId,
        costCenterId,
        currencyId,
        branchId,
        customerId,
        supplierId,
        customerCategoryId,
        supplierCategoryId,
      } = filters;
      const { page = 1, limit = 1000 } = options;

      const partyAccountIds = new Set<string>();
      let restrictToPartyAccounts = false;

      if (customerId || customerCategoryId) {
        restrictToPartyAccounts = true;
        const customers = await prisma.customer.findMany({
          where: {
            companyId,
            ...(customerId ? { id: customerId } : {}),
            ...(customerCategoryId ? { customerCategoryId } : {}),
          },
          select: { accountId: true, mainAccountId: true },
        });
        for (const row of customers) {
          if (row.accountId) partyAccountIds.add(row.accountId);
          if (row.mainAccountId) partyAccountIds.add(row.mainAccountId);
        }
      }
      if (supplierId || supplierCategoryId) {
        restrictToPartyAccounts = true;
        const suppliers = await prisma.supplier.findMany({
          where: {
            companyId,
            ...(supplierId ? { id: supplierId } : {}),
            ...(supplierCategoryId ? { supplierCategoryId } : {}),
          },
          select: { accountId: true, mainAccountId: true },
        });
        for (const row of suppliers) {
          if (row.accountId) partyAccountIds.add(row.accountId);
          if (row.mainAccountId) partyAccountIds.add(row.mainAccountId);
        }
      }

      if (restrictToPartyAccounts && partyAccountIds.size === 0) {
        return {
          data: [],
          summary: { totalCreditBalance: 0, totalDebitBalance: 0, totalAccounts: 0 },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      let currencyCode: string | undefined;
      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: currencyId, companyId },
          select: { code: true },
        });
        currencyCode = currency?.code || undefined;
      }

      const chart = await prisma.account.findMany({
        where: { companyId, deletedAt: null, isActive: true },
        select: { id: true, parentId: true, code: true, arabicName: true, accountKind: true },
        orderBy: { code: 'asc' },
      });
      let visibleIds: string[] | null = null;
      if (accountId && restrictToPartyAccounts && !partyAccountIds.has(accountId)) {
        visibleIds = [];
      } else if (accountId) {
        visibleIds = collectSubtreeIds(String(accountId), chart);
      } else if (restrictToPartyAccounts) {
        const ids = new Set<string>();
        for (const id of partyAccountIds) {
          for (const childId of collectSubtreeIds(id, chart)) ids.add(childId);
        }
        visibleIds = [...ids];
      }
      if (visibleIds && visibleIds.length === 0) {
        return {
          data: [],
          summary: { totalAccounts: 0 },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      const periodEnd = toDate || new Date();
      const entryBase = {
        companyId,
        ...postedOnly(filters),
        isCancelled: false,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
        ...(filters.userId ? { createdBy: String(filters.userId) } : {}),
      };
      const centerIds = await costCenterIdsFor(companyId, costCenterId);
      const lineBase = {
        ...(centerIds ? { costCenterId: { in: centerIds } } : {}),
        ...(visibleIds ? { accountId: { in: visibleIds } } : {}),
      };
      const periodWhere = {
        ...lineBase,
        journalEntry: {
          ...entryBase,
          date: fromDate ? { gte: fromDate, lte: periodEnd } : { lte: periodEnd },
        },
      };
      const openingWhere = { ...lineBase, journalEntry: { ...entryBase, date: { lt: fromDate } } };
      const grouped = async (where: Prisma.JournalEntryLineWhereInput) => {
        if (currencyCode) {
          const rows = await prisma.journalEntryLine.groupBy({
            by: ['accountId'],
            where,
            _sum: { debit: true, credit: true },
          });
          return rows.map((row) => ({
            accountId: row.accountId,
            debit: Number(row._sum.debit ?? 0),
            credit: Number(row._sum.credit ?? 0),
          }));
        }
        const rows = await prisma.journalEntryLine.groupBy({
          by: ['accountId'],
          where,
          _sum: { debitBase: true, creditBase: true },
        });
        return rows.map((row) => ({
          accountId: row.accountId,
          debit: Number(row._sum.debitBase ?? 0),
          credit: Number(row._sum.creditBase ?? 0),
        }));
      };

      const [beforeRows, periodRows] = await Promise.all([
        fromDate ? grouped(openingWhere) : Promise.resolve([]),
        grouped(periodWhere),
      ]);

      const direct = new Map<string, { pd: number; pc: number; md: number; mc: number }>();
      for (const row of beforeRows) {
        direct.set(row.accountId, { pd: row.debit, pc: row.credit, md: 0, mc: 0 });
      }
      for (const row of periodRows) {
        const current = direct.get(row.accountId) ?? { pd: 0, pc: 0, md: 0, mc: 0 };
        current.md = row.debit;
        current.mc = row.credit;
        direct.set(row.accountId, current);
      }

      const byId = new Map(chart.map((account) => [account.id, account]));
      const children = new Map<string, typeof chart>();
      for (const account of chart) {
        if (!account.parentId || !byId.has(account.parentId)) continue;
        const bucket = children.get(account.parentId) ?? [];
        bucket.push(account);
        children.set(account.parentId, bucket);
      }
      const allowed = visibleIds ? new Set(visibleIds) : null;
      const rolled = new Map<string, { pd: number; pc: number; md: number; mc: number }>();
      const roll = (id: string) => {
        const cached = rolled.get(id);
        if (cached) return cached;
        const own = direct.get(id) ?? { pd: 0, pc: 0, md: 0, mc: 0 };
        const total = { ...own };
        for (const child of children.get(id) ?? []) {
          if (allowed && !allowed.has(child.id)) continue;
          const childTotal = roll(child.id);
          total.pd = roundTo4(total.pd + childTotal.pd);
          total.pc = roundTo4(total.pc + childTotal.pc);
          total.md = roundTo4(total.md + childTotal.md);
          total.mc = roundTo4(total.mc + childTotal.mc);
        }
        rolled.set(id, total);
        return total;
      };

      const split = (net: number) =>
        net >= 0
          ? { debit: roundTo4(net), credit: 0 }
          : { debit: 0, credit: roundTo4(-net) };

      const rows: Array<Record<string, unknown>> = [];
      const walk = (account: (typeof chart)[number], depth: number) => {
        if (allowed && !allowed.has(account.id)) return;
        const total = roll(account.id);
        const hasAmount = total.pd || total.pc || total.md || total.mc;
        if (!hasAmount) return;
        const previous = split(total.pd - total.pc);
        const current = split(total.pd - total.pc + total.md - total.mc);
        rows.push({
          account: accountDisplayLabel(account.code, account.arabicName),
          depth,
          accountKind: account.accountKind,
          previousDebit: previous.debit,
          previousCredit: previous.credit,
          movementDebit: roundTo4(total.md),
          movementCredit: roundTo4(total.mc),
          currentDebit: current.debit,
          currentCredit: current.credit,
        });
        for (const child of children.get(account.id) ?? []) walk(child, depth + 1);
      };

      const roots = chart.filter((account) => {
        if (allowed && !allowed.has(account.id)) return false;
        const parent = account.parentId ? byId.get(account.parentId) : undefined;
        return !parent || (allowed ? !allowed.has(parent.id) : false);
      });
      for (const root of roots) walk(root, 0);

      const total = rows.length;
      const pageRows = rows.slice((page - 1) * limit, page * limit);
      const postingRows = rows.filter((row) => row.accountKind === 'POSTING');
      const sumColumn = (key: string) =>
        roundTo4(postingRows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));

      return {
        data: pageRows,
        summary: {
          totalAccounts: postingRows.length,
          previousDebit: sumColumn('previousDebit'),
          previousCredit: sumColumn('previousCredit'),
          movementDebit: sumColumn('movementDebit'),
          movementCredit: sumColumn('movementCredit'),
          currentDebit: sumColumn('currentDebit'),
          currentCredit: sumColumn('currentCredit'),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating account balances credit report');
      throw error;
    }
  }

  /**
   * Get Safe Report
   */
  async getSafeReport(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, safeId, fromDate, toDate, branchId, currencyId } = filters;
      const { page = 1, limit = 5000 } = options;
      const money = await reportMoneyContext(companyId, currencyId ? String(currencyId) : undefined);

      const safes = await prisma.safe.findMany({
        where: { companyId, ...(safeId ? { id: String(safeId) } : {}) },
        select: {
          id: true,
          arabicName: true,
          code: true,
          glAccountId: true,
          glAccount: { select: { parentId: true } },
        },
        orderBy: { code: 'asc' },
      });
      const funds = safes.map((safe) => ({
        id: safe.id,
        arabicName: safe.arabicName,
        code: safe.code,
        glAccountId: safe.glAccountId,
        parentAccountId: safe.glAccount?.parentId ?? null,
      }));
      const accountIds = [
        ...new Set(
          funds.flatMap((safe) => [safe.glAccountId, safe.parentAccountId].filter((id): id is string => Boolean(id)))
        ),
      ];

      const lines = await postedFundLedgerLines(companyId, accountIds, money, {
        branchId: branchId ? String(branchId) : undefined,
        toDate,
        userId: filters.userId ? String(filters.userId) : undefined,
        includeUnposted: Boolean(filters.showUnposted),
      });

      const built = buildSafeMovementRows({
        safes: funds,
        lines,
        fromDate,
        currencyCode: money.reportCurrency,
      });
      const pageStart = (page - 1) * limit;
      const total = built.rows.length;

      return {
        data: built.rows.slice(pageStart, pageStart + limit),
        summary: built.summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating safe report');
      throw error;
    }
  }

  /**
   * Get Financial Papers Flow Report
   */
  async getFinancialPapersFlow(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, branchId, entityId, accountId, currencyId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }
      const currencyCode = await currencyCodeFor(companyId, currencyId ? String(currencyId) : undefined);
      const accountIds = await accountSubtreeIds(companyId, accountId ? String(accountId) : undefined);

      const paperWhere: any = {
        companyId,
        isCancelled: false,
        ...postedOnly(filters),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...(branchId ? { branchId } : {}),
        ...(entityId ? { entityId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
      };
      const { receiptWhere, paymentWhere } = paperSideWheres(
        paperWhere,
        accountIds,
        Boolean(filters.showUnposted)
      );

      {
        const [securitiesReceipts, securitiesPayments] = await Promise.all([
          prisma.securitiesReceipt.findMany({
            where: receiptWhere,
            include: {
              customer: { select: { id: true, code: true, arabicName: true } },
              supplier: { select: { id: true, code: true, arabicName: true } },
              entity: { select: { id: true, arabicName: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.securitiesPayment.findMany({
            where: paymentWhere,
            include: {
              customer: { select: { id: true, code: true, arabicName: true } },
              supplier: { select: { id: true, code: true, arabicName: true } },
              entity: { select: { id: true, arabicName: true } },
            },
            orderBy: { date: 'desc' },
          }),
        ]);

        const allPapers = [
          ...securitiesReceipts.map((sr) => ({
            id: sr.id,
            paperType: 'ورقة قبض',
            type: 'ورقة قبض',
            date: sr.date,
            voucherNumber: sr.serial || sr.receiptNumber || sr.securityNumber,
            description: sr.description,
            amount: Number(sr.amount || 0),
            customer: sr.customer,
            supplier: sr.supplier,
            entityName: sr.entity?.arabicName || sr.entityName,
            status: sr.paperCase,
          })),
          ...securitiesPayments.map((sp) => ({
            id: sp.id,
            paperType: 'ورقة دفع',
            type: 'ورقة دفع',
            date: sp.date,
            voucherNumber: sp.serial || sp.paymentNumber || sp.securityNumber,
            description: sp.description,
            amount: Number(sp.amount || 0),
            customer: sp.customer,
            supplier: sp.supplier,
            entityName: sp.entity?.arabicName || sp.entityName,
            status: sp.paperCase,
          })),
        ].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });

        return {
          data: allPapers.slice((page - 1) * limit, page * limit),
          summary: {
            totalReceipts: securitiesReceipts.length,
            totalPayments: securitiesPayments.length,
            totalCheques: 0,
          },
          pagination: {
            page,
            limit,
            total: allPapers.length,
            totalPages: Math.ceil(allPapers.length / limit) || 1,
          },
        };
      }
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating financial papers flow report');
      throw error;
    }
  }

  /**
   * Get Temp Receipts Report
   */
  async getTempReceiptsReport(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        isPosted: false, // Temp receipts are not posted
        ...(branchId ? { branchId } : {}),
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [receipts, total, amountSum] = await Promise.all([
        prisma.treasuryReceipt.findMany({
          where,
          skip,
          take: limit,
          include: {
            safe: true,
            account: true,
          },
          orderBy: { date: 'desc' },
        }),
        prisma.treasuryReceipt.count({ where }),
        prisma.treasuryReceipt.aggregate({ where, _sum: { amount: true } }),
      ]);

      const totalAmount = Number(amountSum._sum.amount || 0);

      return {
        data: receipts,
        summary: {
          totalReceipts: total,
          totalAmount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating temp receipts report');
      throw error;
    }
  }

  /**
   * Get Treasury Collections Report
   * Shows all treasury receipts (collections)
   */
  async getTreasuryCollections(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, branchId, entityId, accountId, currencyId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }
      const money = await reportMoneyContext(companyId, currencyId ? String(currencyId) : undefined);
      const accountIds = await accountSubtreeIds(companyId, accountId ? String(accountId) : undefined);

      {
        const paperWhere: any = {
          companyId,
          isCancelled: false,
          ...postedOnly(filters),
          paperCase: { in: ['COLLECTED', 'MULTI_COLLECTED'] },
          date: { gte: fromDate, lte: toDate },
          ...(branchId ? { branchId } : {}),
          ...(entityId ? { entityId } : {}),
        };
        const { receiptWhere, paymentWhere } = paperSideWheres(
        paperWhere,
        accountIds,
        Boolean(filters.showUnposted)
      );
        const [securitiesReceipts, securitiesPayments] = await Promise.all([
          prisma.securitiesReceipt.findMany({
            where: receiptWhere,
            include: {
              customer: { select: { id: true, code: true, arabicName: true } },
              supplier: { select: { id: true, code: true, arabicName: true } },
              entity: { select: { id: true, arabicName: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.securitiesPayment.findMany({
            where: paymentWhere,
            include: {
              customer: { select: { id: true, code: true, arabicName: true } },
              supplier: { select: { id: true, code: true, arabicName: true } },
              entity: { select: { id: true, arabicName: true } },
            },
            orderBy: { date: 'desc' },
          }),
        ]);
        const rows = [
          ...securitiesReceipts.map((sr) => ({
            id: sr.id,
            paperType: 'ورقة قبض',
            receiptType: 'securities',
            date: sr.date,
            voucherNumber: sr.serial || sr.receiptNumber || sr.securityNumber,
            description: sr.description,
            amount: convertedAmount(money, {
              face: Number(sr.amount || 0),
              currencyCode: sr.currencyCode,
              exchangeRate: Number(sr.exchangeRate ?? 1),
            }),
            currencyCode: money.reportCurrency,
            customer: sr.customer,
            supplier: sr.supplier,
            entityName: sr.entity?.arabicName || sr.entityName,
            status: sr.paperCase,
          })),
          ...securitiesPayments.map((sp) => ({
            id: sp.id,
            paperType: 'ورقة دفع',
            receiptType: 'securities',
            date: sp.date,
            voucherNumber: sp.serial || sp.paymentNumber || sp.securityNumber,
            description: sp.description,
            amount: convertedAmount(money, {
              face: Number(sp.amount || 0),
              currencyCode: sp.currencyCode,
              exchangeRate: Number(sp.exchangeRate ?? 1),
            }),
            currencyCode: money.reportCurrency,
            customer: sp.customer,
            supplier: sp.supplier,
            entityName: sp.entity?.arabicName || sp.entityName,
            status: sp.paperCase,
          })),
        ].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
        const skip = (page - 1) * limit;
        const paginated = rows.slice(skip, skip + limit);
        const totalCollections = rows.reduce((sum, row) => sum + row.amount, 0);
        return {
          data: paginated,
          summary: {
            totalCollections,
            currencyCode: money.reportCurrency,
            totalReceipts: rows.length,
            byType: { cash: 0, bank: 0, safe: 0, party: 0, securities: rows.length },
          },
          pagination: {
            page,
            limit,
            total: rows.length,
            totalPages: Math.ceil(rows.length / limit) || 1,
          },
        };
      }
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating treasury collections report');
      throw error;
    }
  }

  /**
   * Get Financial Papers Report
   * Shows financial papers/securities (different from financial papers flow)
   */
  async getFinancialPapers(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, branchId, entityId } = filters;
      const { page = 1, limit = 100 } = options;

      // Get securities receipts, payments, and renewals
      const dateFilter = fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {};

      const currencyCode = await currencyCodeFor(companyId, filters.currencyId ? String(filters.currencyId) : undefined);
      const scopedAccountIds = await accountSubtreeIds(companyId, filters.accountId ? String(filters.accountId) : undefined);
      const where: any = {
        companyId,
        ...dateFilter,
        isCancelled: false,
        ...postedOnly(filters),
        ...(currencyCode ? { currencyCode } : {}),
      };
      const { receiptWhere, paymentWhere } = paperSideWheres(
        where,
        scopedAccountIds,
        Boolean(filters.showUnposted)
      );

      if (branchId) {
        where.branchId = branchId;
      }
      if (entityId) {
        where.entityId = entityId;
      }

      const chequeDateFilter =
        fromDate || toDate
          ? {
              OR: [
                {
                  dueDate: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                },
                {
                  createdAt: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                },
              ],
            }
          : {};

      const [securitiesReceipts, securitiesPayments, securitiesRenewals, cheques] = await Promise.all([
        prisma.securitiesReceipt.findMany({
          where: receiptWhere,
          include: {
            customer: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            supplier: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            entity: { select: { id: true, arabicName: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.securitiesPayment.findMany({
          where: paymentWhere,
          include: {
            customer: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            supplier: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            entity: { select: { id: true, arabicName: true } },
          },
          orderBy: { date: 'desc' },
        }),
        entityId
          ? Promise.resolve([])
          : prisma.securitiesRenewal.findMany({
          where: {
            companyId,
            ...dateFilter,
            isCancelled: false,
            ...(branchId ? { branchId } : {}),
          },
          orderBy: { date: 'desc' },
        }),
        entityId
          ? Promise.resolve([])
          : prisma.cheque.findMany({
          where: {
            companyId,
            ...(branchId ? { branchId } : {}),
            ...chequeDateFilter,
          },
          include: {
            customer: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            supplier: { select: { id: true, code: true, arabicName: true, accountId: true, mainAccountId: true } },
            bankAccount: { select: { id: true, code: true, arabicName: true, glAccountId: true } },
            clearJournalEntry: { select: { date: true } },
            endorseJournalEntry: { select: { date: true } },
            bounceJournalEntry: { select: { date: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const paperIds = [
        ...securitiesReceipts.map((row) => row.id),
        ...securitiesPayments.map((row) => row.id),
      ];
      const accountIds = [
        ...securitiesReceipts.flatMap((row) => [
          row.destinationAccountId,
          row.depositAccountId,
          row.partyAccountId,
          row.customer?.accountId,
          row.customer?.mainAccountId,
          row.supplier?.accountId,
          row.supplier?.mainAccountId,
        ]),
        ...securitiesPayments.flatMap((row) => [
          row.destinationAccountId,
          row.partyAccountId,
          row.customer?.accountId,
          row.customer?.mainAccountId,
          row.supplier?.accountId,
          row.supplier?.mainAccountId,
        ]),
        ...cheques.flatMap((row) => [
          row.bankAccount?.glAccountId,
          row.customer?.accountId,
          row.customer?.mainAccountId,
          row.supplier?.accountId,
          row.supplier?.mainAccountId,
        ]),
      ].filter((id): id is string => Boolean(id));
      const currencyCodes = [
        ...securitiesReceipts.map((row) => row.currencyCode),
        ...securitiesPayments.map((row) => row.currencyCode),
        ...cheques.map((row) => row.currencyCode),
      ].filter((code): code is string => Boolean(code));

      const [accounts, currencies, paperJournals, collectionLines] = await Promise.all([
        accountIds.length
          ? prisma.account.findMany({
              where: { companyId, id: { in: [...new Set(accountIds)] }, deletedAt: null },
              select: { id: true, arabicName: true, code: true },
            })
          : Promise.resolve([]),
        currencyCodes.length
          ? prisma.currency.findMany({
              where: { companyId, code: { in: [...new Set(currencyCodes)] } },
              select: { code: true, arabicName: true },
            })
          : Promise.resolve([]),
        paperIds.length
          ? prisma.journalEntry.findMany({
              where: {
                companyId,
                sourceId: { in: paperIds },
                isCancelled: false,
              },
              select: {
                sourceId: true,
                entryType: true,
                date: true,
                lines: {
                  select: { costCenter: { select: { arabicName: true } } },
                  orderBy: { lineNumber: 'asc' },
                  take: 8,
                },
              },
            })
          : Promise.resolve([]),
        paperIds.length
          ? prisma.multiCollectionLine.findMany({
              where: { companyId, paperId: { in: paperIds } },
              select: { paperId: true, collectionDate: true },
              orderBy: { collectionDate: 'desc' },
            })
          : Promise.resolve([]),
      ]);

      const accountById = new Map(accounts.map((account) => [account.id, account]));
      const accountNameById = new Map(
        accounts.map((account) => [account.id, formatPaperAccountLabel(account)])
      );
      const currencyNameByCode = new Map(
        currencies.map((currency) => [currency.code, currency.arabicName || currency.code])
      );
      const journalsByPaper = new Map<string, typeof paperJournals>();
      for (const entry of paperJournals) {
        if (!entry.sourceId) continue;
        const list = journalsByPaper.get(entry.sourceId) ?? [];
        list.push(entry);
        journalsByPaper.set(entry.sourceId, list);
      }
      const latestCollectionByPaper = new Map<string, Date>();
      for (const line of collectionLines) {
        if (!latestCollectionByPaper.has(line.paperId)) {
          latestCollectionByPaper.set(line.paperId, line.collectionDate);
        }
      }

      const financialPapers = [
        ...cheques.map((cheque) =>
          toFinancialPaperRow({
            id: cheque.id,
            paperType: cheque.direction === 'INWARD' ? 'شيك قبض' : 'شيك صرف',
            paperNumber: cheque.chequeNumber,
            issueDate: cheque.createdAt,
            dueDate: cheque.dueDate,
            accountName: paperReportAccountName({
              partyLedgerAccount: accountById.get(
                cheque.customer?.accountId ||
                  cheque.customer?.mainAccountId ||
                  cheque.supplier?.accountId ||
                  cheque.supplier?.mainAccountId ||
                  ''
              ),
              notesAccount: cheque.bankAccount?.glAccountId
                ? accountById.get(cheque.bankAccount.glAccountId)
                : null,
              partyName: partyLabel(cheque.customer, cheque.supplier),
            }),
            description: cheque.description || cheque.bankName,
            entityName: cheque.bankName,
            amount: Number(cheque.amount || 0),
            paperStatus: CHEQUE_STATUS_LABEL[cheque.status] || cheque.status,
            collectionDate: cheque.status === 'COLLECTED' ? cheque.clearJournalEntry?.date ?? null : null,
            endorsementDate: cheque.status === 'ENDORSED' ? cheque.endorseJournalEntry?.date ?? null : null,
            returnDate:
              cheque.status === 'BOUNCED' || cheque.status === 'RETURNED_TO_DRAWER'
                ? cheque.bounceJournalEntry?.date ?? null
                : null,
            currencyName: currencyLabel(currencyNameByCode, cheque.currencyCode),
            costCenterName: null,
            portfolioName: cheque.bankAccount?.arabicName || cheque.bankAccount?.code || null,
          })
        ),
        ...securitiesReceipts.map((sr) => {
          const paperCase = resolveSecuritiesPaperCase(sr);
          const dates = paperLifecycleDates(journalsByPaper.get(sr.id) ?? [], latestCollectionByPaper.get(sr.id));
          return toFinancialPaperRow({
            id: sr.id,
            paperType: 'ورقة قبض',
            paperNumber: sr.securityNumber || sr.serial || sr.receiptNumber,
            issueDate: sr.date,
            dueDate: sr.dueDate,
            accountName: paperReportAccountName({
              partyAccount: sr.partyAccountId ? accountById.get(sr.partyAccountId) : null,
              partyLedgerAccount: accountById.get(
                sr.customer?.accountId ||
                  sr.customer?.mainAccountId ||
                  sr.supplier?.accountId ||
                  sr.supplier?.mainAccountId ||
                  ''
              ),
              notesAccount: accountById.get(sr.destinationAccountId || sr.depositAccountId || ''),
              partyName: partyLabel(sr.customer, sr.supplier) || sr.issuerName,
            }),
            description: sr.description,
            entityName: sr.entity?.arabicName || sr.entityName || sr.issuerBank,
            amount: Number(sr.amount || 0),
            paperStatus:
              openingPaperStatus(sr.isOpening, sr.isPosted) || SECURITIES_PAPER_CASE_LABEL[paperCase],
            collectionDate: dates.collectionDate || (paperCase === 'COLLECTED' ? sr.postedAt || sr.depositDate : null),
            endorsementDate: paperCase === 'ENDORSED' ? dates.endorsementDate : null,
            returnDate: paperCase === 'BOUNCED' ? dates.returnDate || sr.cancelledAt : null,
            currencyName: currencyLabel(currencyNameByCode, sr.currencyCode),
            costCenterName: dates.costCenterName,
            portfolioName:
              (sr.destinationAccountId ? accountNameById.get(sr.destinationAccountId) : null) ||
              (sr.depositAccountId ? accountNameById.get(sr.depositAccountId) : null) ||
              null,
          });
        }),
        ...securitiesPayments.map((sp) => {
          const paperCase = resolveSecuritiesPaperCase(sp);
          const dates = paperLifecycleDates(journalsByPaper.get(sp.id) ?? [], latestCollectionByPaper.get(sp.id));
          return toFinancialPaperRow({
            id: sp.id,
            paperType: 'ورقة دفع',
            paperNumber: sp.securityNumber || sp.serial || sp.paymentNumber,
            issueDate: sp.date,
            dueDate: sp.dueDate,
            accountName: paperReportAccountName({
              partyAccount: sp.partyAccountId ? accountById.get(sp.partyAccountId) : null,
              partyLedgerAccount: accountById.get(
                sp.customer?.accountId ||
                  sp.customer?.mainAccountId ||
                  sp.supplier?.accountId ||
                  sp.supplier?.mainAccountId ||
                  ''
              ),
              notesAccount: sp.destinationAccountId ? accountById.get(sp.destinationAccountId) : null,
              partyName: partyLabel(sp.customer, sp.supplier) || sp.payeeName,
            }),
            description: sp.description,
            entityName: sp.entity?.arabicName || sp.entityName || sp.payeeBank,
            amount: Number(sp.amount || 0),
            paperStatus: SECURITIES_PAPER_CASE_LABEL[paperCase],
            collectionDate: dates.collectionDate || (paperCase === 'COLLECTED' ? sp.postedAt : null),
            endorsementDate: paperCase === 'ENDORSED' ? dates.endorsementDate : null,
            returnDate: paperCase === 'BOUNCED' ? dates.returnDate || sp.cancelledAt : null,
            currencyName: currencyLabel(currencyNameByCode, sp.currencyCode),
            costCenterName: dates.costCenterName,
            portfolioName: sp.destinationAccountId ? accountNameById.get(sp.destinationAccountId) || null : null,
          });
        }),
        ...securitiesRenewals.map((srn) =>
          toFinancialPaperRow({
            id: srn.id,
            paperType: 'تجديد',
            paperNumber: srn.serial || srn.renewalNumber,
            issueDate: srn.date,
            dueDate: srn.newDueDate,
            accountName: null,
            description: srn.description,
            entityName: null,
            amount: Number(srn.newAmount || 0),
            paperStatus: srn.isPosted ? 'محصلة' : 'محررة',
            collectionDate: null,
            endorsementDate: null,
            returnDate: null,
            currencyName: null,
            costCenterName: null,
            portfolioName: null,
          })
        ),
      ].sort((a, b) => {
        const dateA = a.issueDate ? new Date(a.issueDate).getTime() : 0;
        const dateB = b.issueDate ? new Date(b.issueDate).getTime() : 0;
        return dateB - dateA;
      });

      const skip = (page - 1) * limit;
      const paginatedData = financialPapers.slice(skip, skip + limit);

      const totalAmount = financialPapers.reduce((sum, paper) => sum + paper.amount, 0);
      const receiptAmount = financialPapers
        .filter((paper) => paper.paperType === 'ورقة قبض' || paper.paperType === 'شيك قبض')
        .reduce((sum, paper) => sum + paper.amount, 0);
      const paymentAmount = financialPapers
        .filter((paper) => paper.paperType === 'ورقة دفع' || paper.paperType === 'شيك صرف')
        .reduce((sum, paper) => sum + paper.amount, 0);

      return {
        data: paginatedData,
        summary: {
          totalPapers: financialPapers.length,
          totalAmount,
          receiptAmount,
          paymentAmount,
          receipts: securitiesReceipts.length,
          payments: securitiesPayments.length,
          renewals: securitiesRenewals.length,
        },
        pagination: {
          page,
          limit,
          total: financialPapers.length,
          totalPages: Math.ceil(financialPapers.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating financial papers report');
      throw error;
    }
  }
}

const CHEQUE_STATUS_LABEL: Record<string, string> = {
  UNDER_HAND: 'تحت التحصيل',
  SENT_TO_BANK: 'مرسلة للبنك',
  COLLECTED: 'محصلة',
  ENDORSED: 'مظهرة',
  BOUNCED: 'مرتدة',
  RETURNED_TO_DRAWER: 'مرتجعة',
  CANCELLED: 'ملغاة',
};

const CURRENCY_NAME_FALLBACK: Record<string, string> = {
  EGP: 'جنيه مصري',
  USD: 'دولار أمريكي',
  EUR: 'يورو',
  SAR: 'ريال سعودي',
};

function partyLabel(
  customer?: { arabicName?: string | null } | null,
  supplier?: { arabicName?: string | null } | null
) {
  return customer?.arabicName || supplier?.arabicName || null;
}

function currencyLabel(names: Map<string, string>, code?: string | null) {
  if (!code) return null;
  return names.get(code) || CURRENCY_NAME_FALLBACK[code] || code;
}

function latestJournalDate(
  entries: Array<{ entryType?: string | null; date?: Date | null }>,
  types: string[]
) {
  const matches = entries.filter((entry) => entry.entryType && types.includes(entry.entryType) && entry.date);
  if (!matches.length) return null;
  return matches.reduce((latest, entry) => (entry.date! > latest ? entry.date! : latest), matches[0].date!);
}

function paperLifecycleDates(
  entries: Array<{
    entryType?: string | null;
    date?: Date | null;
    lines?: Array<{ costCenter?: { arabicName?: string | null } | null }>;
  }>,
  multiDate?: Date | null
) {
  const costCenterName =
    entries
      .flatMap((entry) => entry.lines ?? [])
      .map((line) => line.costCenter?.arabicName)
      .find((name) => Boolean(name)) || null;
  return {
    collectionDate: multiDate || latestJournalDate(entries, ['تحصيل', 'تحصيل متعدد', 'إيداع']),
    endorsementDate: latestJournalDate(entries, ['تظهير']),
    returnDate: latestJournalDate(entries, ['ارتداد']),
    costCenterName,
  };
}

function toFinancialPaperRow(row: {
  id: string;
  paperType: string;
  paperNumber?: string | null;
  issueDate?: Date | null;
  dueDate?: Date | null;
  accountName?: string | null;
  description?: string | null;
  entityName?: string | null;
  amount: number;
  paperStatus?: string | null;
  collectionDate?: Date | null;
  endorsementDate?: Date | null;
  returnDate?: Date | null;
  currencyName?: string | null;
  costCenterName?: string | null;
  portfolioName?: string | null;
}) {
  return {
    paperNumber: row.paperNumber ?? null,
    paperType: row.paperType,
    issueDate: row.issueDate ?? null,
    dueDate: row.dueDate ?? null,
    accountName: row.accountName ?? null,
    description: row.description ?? null,
    entityName: row.entityName ?? null,
    amount: row.amount,
    paperStatus: row.paperStatus ?? null,
    collectionDate: row.collectionDate ?? null,
    endorsementDate: row.endorsementDate ?? null,
    returnDate: row.returnDate ?? null,
    currencyName: row.currencyName ?? null,
    costCenterName: row.costCenterName ?? null,
    portfolioName: row.portfolioName ?? null,
    id: row.id,
  };
}

export const reportsService = new ReportsService();

