// @ts-nocheck — report queries predate current Prisma schema shapes; tighten types incrementally.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { financialReportService } from './financial-report.service';
import { agedOpenItemsService, type AgingBucketKey } from './aged-open-items.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { classifyAccount } from './financial-report.util';

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
        isPosted: true,
        isCancelled: false,
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

      const [journalEntries, total] = await Promise.all([
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
      ]);

      // Calculate summary
      const summary = includeDetails
        ? {
            totalEntries: total,
            totalDebit: 0,
            totalCredit: 0,
          }
        : undefined;

      return {
        data: journalEntries,
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
        isPosted: true,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
          include: {
            lines: {
              include: {
                account: {
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
        isPosted: true,
        isCancelled: false,
        lines: {
          some: lineFilter,
        },
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

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
   * @deprecated M16 (Item 35): superseded by
   * `financialReportService.getBalanceSheet` (single grouped SQL aggregate,
   * correct account classification, tied out `sections`/`summary`). This
   * legacy version is N+1 (one `journalEntryLine.findMany` per account) and
   * its `include: { accountType: {...} } }` filters a scalar column as a
   * relation, which throws at runtime — the `/balance-sheet` and
   * `/financial-position-statement` routes that used to call it (via
   * `getFinancialPositionStatement`) are both retired (410). Unreachable
   * dead code kept only for reference.
   */
  async getBalanceSheet(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { toDate, companyId, branchId } = filters;

      if (!toDate) {
        throw new Error('To date is required');
      }

      const where: any = {
        companyId,
        date: {
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
      }

      // Get all accounts with their balances
      const accounts = await prisma.account.findMany({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
        },
        include: {
          accountType: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      // Calculate balances for each account
      const accountBalances = await Promise.all(
        accounts.map(async (account) => {
          const journalLines = await prisma.journalEntryLine.findMany({
            where: {
              accountId: account.id,
              journalEntry: {
                ...where,
              },
            },
          });

          const totalDebit = journalLines.reduce(
            (sum, line) => sum + Number(line.debit),
            0
          );
          const totalCredit = journalLines.reduce(
            (sum, line) => sum + Number(line.credit),
            0
          );

          const balance = totalDebit - totalCredit;

          return {
            account: {
              id: account.id,
              code: account.code,
              arabicName: account.arabicName,
              accountType: account.accountType,
            },
            balance,
            totalDebit,
            totalCredit,
          };
        })
      );

      // Group by account type
      const grouped = accountBalances.reduce((acc, item) => {
        const typeCode = item.account.accountType?.code || 'OTHER';
        if (!acc[typeCode]) {
          acc[typeCode] = {
            accountType: item.account.accountType,
            accounts: [],
            totalBalance: 0,
          };
        }
        acc[typeCode].accounts.push(item);
        acc[typeCode].totalBalance += item.balance;
        return acc;
      }, {} as any);

      return {
        data: Object.values(grouped),
        summary: {
          totalAssets: grouped['ASSET']?.totalBalance || 0,
          totalLiabilities: grouped['LIABILITY']?.totalBalance || 0,
          totalEquity: grouped['EQUITY']?.totalBalance || 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating balance sheet report');
      throw error;
    }
  }

  /**
   * @deprecated M16 (Item 35): superseded by
   * `financialReportService.getIncomeStatement`. Same N+1 and
   * scalar-vs-relation `accountType` bugs as `getBalanceSheet` above — the
   * `/income-statement` and `/profit-loss` (via `getProfitAndLoss`) routes
   * that used to call it are both retired (410). Unreachable dead code kept
   * only for reference.
   */
  async getIncomeStatement(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
      }

      // Get revenue and expense accounts
      const revenueAccounts = await prisma.account.findMany({
        where: {
          companyId,
          accountType: {
            code: 'REVENUE',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      const expenseAccounts = await prisma.account.findMany({
        where: {
          companyId,
          accountType: {
            code: 'EXPENSE',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      // Calculate revenue
      const revenueData = await Promise.all(
        revenueAccounts.map(async (account) => {
          const journalLines = await prisma.journalEntryLine.findMany({
            where: {
              accountId: account.id,
              journalEntry: {
                ...where,
              },
            },
          });

          const totalDebit = journalLines.reduce(
            (sum, line) => sum + Number(line.debit),
            0
          );
          const totalCredit = journalLines.reduce(
            (sum, line) => sum + Number(line.credit),
            0
          );

          return {
            account: {
              id: account.id,
              code: account.code,
              arabicName: account.arabicName,
            },
            amount: totalCredit - totalDebit, // Revenue is credit - debit
          };
        })
      );

      // Calculate expenses
      const expenseData = await Promise.all(
        expenseAccounts.map(async (account) => {
          const journalLines = await prisma.journalEntryLine.findMany({
            where: {
              accountId: account.id,
              journalEntry: {
                ...where,
              },
            },
          });

          const totalDebit = journalLines.reduce(
            (sum, line) => sum + Number(line.debit),
            0
          );
          const totalCredit = journalLines.reduce(
            (sum, line) => sum + Number(line.credit),
            0
          );

          return {
            account: {
              id: account.id,
              code: account.code,
              arabicName: account.arabicName,
            },
            amount: totalDebit - totalCredit, // Expense is debit - credit
          };
        })
      );

      const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0);
      const netIncome = totalRevenue - totalExpenses;

      return {
        data: {
          revenue: revenueData,
          expenses: expenseData,
        },
        summary: {
          totalRevenue,
          totalExpenses,
          netIncome,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating income statement report');
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
        isPosted: true,
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
            isPosted: true,
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
        days_120_plus: 'over90',
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
        over90: report.bucketTotals.days_91_120 + report.bucketTotals.days_120_plus,
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
      const { toDate, companyId, branchId } = filters;
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

      const startDate = fy?.startDate ?? new Date(toDate.getFullYear(), 0, 1);

      const tb = await financialReportService.getTrialBalance({
        companyId,
        branchId,
        fiscalYearId: fy?.id,
        startDate,
        endDate: toDate,
      });

      const accountIds = tb.accounts.map((a) => a.accountId);
      const accountsMeta = await prisma.account.findMany({
        where: { id: { in: accountIds } },
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
   * Get Cost Centers Balance report.
   *
   * M16 fix (N+1): this ran one `journalEntryLine.findMany` *per cost
   * center* inside `Promise.all(costCenters.map(...))`, and it also used
   * transaction-currency `debit`/`credit` instead of `debitBase`/
   * `creditBase`. Delegates to `financialReportService.getCostCenterReport`
   * (single grouped SQL aggregate on `debitBase`/`creditBase`) instead.
   */
  async getCostCentersBalance(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { toDate, companyId, costCenterId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      if (!toDate) {
        throw new Error('To date is required');
      }

      const ccReport = await financialReportService.getCostCenterReport({
        companyId,
        branchId,
        startDate: new Date(0),
        endDate: toDate,
      });

      let centers = ccReport.centers;
      if (costCenterId) {
        centers = centers.filter((c) => c.costCenterId === costCenterId);
      }

      const costCenterBalances = centers.map((c) => ({
        costCenter: {
          id: c.costCenterId,
          code: c.code,
          arabicName: c.arabicName,
        },
        debit: c.totalDebit,
        credit: c.totalCredit,
        balance: c.net,
      }));

      const summary = {
        totalCostCenters: costCenterBalances.length,
        totalDebit: roundTo4(costCenterBalances.reduce((sum, item) => sum + item.debit, 0)),
        totalCredit: roundTo4(costCenterBalances.reduce((sum, item) => sum + item.credit, 0)),
        totalBalance: roundTo4(costCenterBalances.reduce((sum, item) => sum + item.balance, 0)),
      };

      // M16 fix: `pagination.total` was already correct, but `data` was
      // always the full unsliced array — `page`/`limit` were computed and
      // returned without ever being applied to the rows themselves.
      const total = costCenterBalances.length;
      const skip = (page - 1) * limit;
      const pageData = costCenterBalances.slice(skip, skip + limit);

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
      logger.error({ error, filters, options }, 'Error generating cost centers balance report');
      throw error;
    }
  }

  /**
   * Get Trading Account report.
   *
   * M16 fix: `accountType` is a scalar `String?` column on `Account`, not a
   * relation — filtering with `accountType: { code: 'REVENUE' }` throws a
   * Prisma validation error at runtime, so this endpoint was completely
   * broken. Also, "EXPENSE" accounts (52/53/61/62) are not COGS (51); a
   * trading account should net sales against COGS only. Both are fixed by
   * classifying accounts via the shared `classifyAccount` helper (the same
   * code-prefix + accountType logic used by the M16 financial reports).
   */
  async getTradingAccount(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const allAccounts = await prisma.account.findMany({
        where: { companyId, isActive: true, deletedAt: null },
        select: { id: true, code: true, accountType: true },
      });

      const salesAccounts = allAccounts.filter((a) => classifyAccount(a.code, a.accountType) === 'REVENUE');
      const cogsAccounts = allAccounts.filter((a) => classifyAccount(a.code, a.accountType) === 'COGS');

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
      }

      // Calculate sales
      const salesLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: salesAccounts.map((a) => a.id) },
          journalEntry: where,
        },
      });

      const totalSales = salesLines.reduce(
        (sum, line) => sum + Number(line.credit) - Number(line.debit),
        0
      );

      // Calculate cost of goods sold
      const cogsLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: cogsAccounts.map((a) => a.id) },
          journalEntry: where,
        },
      });

      const totalCOGS = cogsLines.reduce(
        (sum, line) => sum + Number(line.debit) - Number(line.credit),
        0
      );

      const grossProfit = totalSales - totalCOGS;

      return {
        data: [
          {
            item: 'المبيعات',
            amount: totalSales,
          },
          {
            item: 'تكلفة البضاعة المباعة',
            amount: totalCOGS,
          },
          {
            item: 'مجمل الربح',
            amount: grossProfit,
          },
        ],
        summary: {
          totalSales,
          totalCOGS,
          grossProfit,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating trading account report');
      throw error;
    }
  }

  /**
   * @deprecated M16 (Item 35): the `/profit-loss` route is retired (410);
   * see `getIncomeStatement` above.
   */
  async getProfitAndLoss(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    return this.getIncomeStatement(filters, options);
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
      const { fromDate, toDate, companyId, accountId, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const bankAccountLinks = await prisma.bankAccount.findMany({
        where: { companyId, glAccountId: { not: null }, ...(accountId ? { glAccountId: accountId } : {}) },
        select: { glAccountId: true },
      });
      const bankGlAccountIds = bankAccountLinks
        .map((b) => b.glAccountId)
        .filter((id): id is string => !!id);

      const bankAccounts = bankGlAccountIds.length
        ? await prisma.account.findMany({
            where: { id: { in: bankGlAccountIds }, isActive: true, deletedAt: null },
            select: { id: true, code: true, arabicName: true },
          })
        : [];

      if (bankAccounts.length === 0) {
        return {
          data: [],
          summary: { message: 'No bank accounts found' },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
        lines: {
          some: {
            accountId: { in: bankAccounts.map((a) => a.id) },
          },
        },
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
          include: {
            lines: {
              where: {
                accountId: { in: bankAccounts.map((a) => a.id) },
              },
              include: {
                account: {
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
        summary: {
          totalEntries: total,
          bankAccounts: bankAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            arabicName: a.arabicName,
          })),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating bank movement report');
      throw error;
    }
  }

  /**
   * @deprecated H20: superseded by `financialReportService.getCashFlowStatement`
   * (real indirect-method statement, `debitBase`/`creditBase`, GL tie-out).
   * The `/cash-flow` route is retired; this is unused dead code kept only
   * for reference and will be removed in a follow-up cleanup.
   */
  async getCashFlow(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get cash accounts
      const cashAccounts = await prisma.account.findMany({
        where: {
          companyId,
          accountType: {
            code: 'CASH',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
        lines: {
          some: {
            accountId: { in: cashAccounts.map((a) => a.id) },
          },
        },
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const journalEntries = await prisma.journalEntry.findMany({
        where,
        orderBy: [{ date: 'asc' }],
        include: {
          lines: {
            where: {
              accountId: { in: cashAccounts.map((a) => a.id) },
            },
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      // Calculate opening balance (before fromDate)
      const openingLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: cashAccounts.map((a) => a.id) },
          journalEntry: {
            companyId,
            date: { lt: fromDate },
            isPosted: true,
            isCancelled: false,
          },
        },
      });

      const openingBalance = openingLines.reduce(
        (sum, line) => sum + Number(line.debit) - Number(line.credit),
        0
      );

      // Calculate period totals
      const periodLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: cashAccounts.map((a) => a.id) },
          journalEntry: where,
        },
      });

      const totalInflow = periodLines.reduce((sum, line) => sum + Number(line.debit), 0);
      const totalOutflow = periodLines.reduce((sum, line) => sum + Number(line.credit), 0);
      const netCashFlow = totalInflow - totalOutflow;
      const closingBalance = openingBalance + netCashFlow;

      return {
        data: journalEntries,
        summary: {
          openingBalance,
          totalInflow,
          totalOutflow,
          netCashFlow,
          closingBalance,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cash flow report');
      throw error;
    }
  }

  /**
   * Get Unposted Operations report
   */
  async getUnpostedOperations(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
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

      const skip = (page - 1) * limit;

      const [journalEntries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            lines: {
              include: {
                account: {
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
   * @deprecated M16 (Item 35): the `/financial-position-statement` route is
   * retired (410); see `getBalanceSheet` above.
   */
  async getFinancialPositionStatement(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    return this.getBalanceSheet(filters, options);
  }

  /**
   * Get Cost Center Balance (Single Cost Center)
   */
  async getCostCenterBalance(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, costCenterId, toDate, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      if (!costCenterId) {
        return this.getCostCentersBalance(filters, options);
      }

      const asOf = toDate || new Date();
      const lines = await prisma.journalEntryLine.findMany({
        where: {
          costCenterId,
          journalEntry: {
            companyId,
            isPosted: true,
            isCancelled: false,
            date: { lte: asOf },
            ...(branchId ? { branchId } : {}),
          },
        },
        include: {
          account: { select: { id: true, code: true, arabicName: true } },
          costCenter: { select: { id: true, code: true, arabicName: true } },
          journalEntry: {
            select: { id: true, date: true, voucherNumber: true, description: true },
          },
        },
        orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
      });

      let balance = 0;
      const balanceData = lines.map((line) => {
        const debit = Number(line.debitBase || line.debit || 0);
        const credit = Number(line.creditBase || line.credit || 0);
        balance += debit - credit;
        return {
          date: line.journalEntry?.date,
          voucherNumber: line.journalEntry?.voucherNumber,
          description: line.description || line.journalEntry?.description,
          account: line.account,
          costCenter: line.costCenter,
          debit,
          credit,
          runningBalance: balance,
        };
      });

      return {
        data: balanceData.slice((page - 1) * limit, page * limit),
        summary: {
          finalBalance: balance,
          totalMovements: lines.length,
        },
        pagination: {
          page,
          limit,
          total: balanceData.length,
          totalPages: Math.ceil(balanceData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cost center balance report');
      throw error;
    }
  }

  /**
   * Get Budget Report
   */
  async getBudgetReport(filters: ReportFilters, options: ReportOptions = {}): Promise<ReportResult> {
    try {
      const { companyId, fromDate, toDate, costCenterId, branchId } = filters;
      const { page = 1, limit = 1000 } = options;

      const periodStart = fromDate ?? new Date(new Date().getFullYear(), 0, 1);
      const periodEnd = toDate ?? new Date();

      const journalWhere = {
        isPosted: true,
        isCancelled: false,
        date: { gte: periodStart, lte: periodEnd },
        ...(branchId ? { branchId } : {}),
      };

      const accounts = await prisma.account.findMany({
        where: {
          companyId,
          isActive: true,
          deletedAt: null,
          accountKind: 'POSTING',
          OR: [
            { budget: { not: null } },
            {
              journalEntryLines: {
                some: {
                  ...(costCenterId ? { costCenterId } : {}),
                  journalEntry: journalWhere,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          code: true,
          arabicName: true,
          accountType: true,
          budget: true,
          journalEntryLines: {
            where: {
              ...(costCenterId ? { costCenterId } : {}),
              journalEntry: journalWhere,
            },
            select: { debitBase: true, creditBase: true, debit: true, credit: true },
          },
        },
        orderBy: { code: 'asc' },
      });

      const rows = accounts.map((account) => {
        const debit = account.journalEntryLines.reduce(
          (sum, line) => sum + Number(line.debitBase || line.debit || 0),
          0
        );
        const credit = account.journalEntryLines.reduce(
          (sum, line) => sum + Number(line.creditBase || line.credit || 0),
          0
        );
        const cls = classifyAccount(account.code, account.accountType);
        const actual = cls === 'REVENUE' ? credit - debit : debit - credit;
        const budget = Number(account.budget || 0);
        return {
          account: {
            id: account.id,
            code: account.code,
            arabicName: account.arabicName,
            accountType: account.accountType,
          },
          budget,
          actual,
          variance: budget - actual,
        };
      });

      const total = rows.length;
      return {
        data: rows.slice((page - 1) * limit, page * limit),
        summary: {
          totalAccounts: total,
          totalBudget: rows.reduce((sum, row) => sum + row.budget, 0),
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
      const { companyId, fromDate, toDate, accountId, costCenterId, branchId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const lines = await prisma.journalEntryLine.findMany({
        where: {
          ...(accountId ? { accountId } : {}),
          ...(costCenterId ? { costCenterId } : {}),
          debit: { gt: 0 },
          journalEntry: {
            companyId,
            date: { gte: fromDate, lte: toDate },
            isPosted: true,
            isCancelled: false,
            ...(branchId ? { branchId } : {}),
          },
        },
        include: {
          account: {
            select: { id: true, code: true, arabicName: true, accountType: true },
          },
        },
      });

      const accountMap = new Map<string, any>();
      lines.forEach((line) => {
        const cls = classifyAccount(line.account?.code ?? '', line.account?.accountType);
        if (cls !== 'EXPENSE' && cls !== 'COGS') return;
        const key = line.accountId;
        if (!accountMap.has(key)) {
          accountMap.set(key, {
            account: line.account,
            totalExpenses: 0,
            entryCount: 0,
          });
        }
        const accountData = accountMap.get(key)!;
        accountData.totalExpenses += Number(line.debitBase || line.debit || 0);
        accountData.entryCount += 1;
      });

      const result = Array.from(accountMap.values())
        .sort((a, b) => b.totalExpenses - a.totalExpenses)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalExpenses: Array.from(accountMap.values()).reduce(
            (sum, acc) => sum + acc.totalExpenses,
            0
          ),
          totalAccounts: accountMap.size,
        },
        pagination: {
          page,
          limit,
          total: accountMap.size,
          totalPages: Math.ceil(accountMap.size / limit),
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
      const { companyId, fromDate, toDate } = filters;
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
        isPosted: true,
        isCancelled: false,
      };

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

      const operations = journalEntries.map((entry) => ({
        date: entry.date,
        voucherNumber: entry.voucherNumber,
        description: entry.description,
        sourceType: entry.sourceType,
        sourceNumber: entry.sourceNumber,
        totalDebit: entry.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0),
        totalCredit: entry.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0),
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

      const accountWhere: Record<string, unknown> = {
        companyId,
        isActive: true,
        deletedAt: null,
        accountKind: 'POSTING',
      };
      if (accountId && restrictToPartyAccounts) {
        accountWhere.id = partyAccountIds.has(accountId) ? accountId : '__none__';
      } else if (accountId) {
        accountWhere.id = accountId;
      } else if (restrictToPartyAccounts) {
        accountWhere.id = { in: [...partyAccountIds] };
      }
      if (currencyCode) accountWhere.currencyCode = currencyCode;

      const lineWhere: Record<string, unknown> = {
        journalEntry: {
          isPosted: true,
          isCancelled: false,
          date: { lte: toDate || new Date() },
          ...(branchId ? { branchId } : {}),
          ...(currencyCode ? { currencyCode } : {}),
        },
        ...(costCenterId ? { costCenterId } : {}),
      };

      const accounts = await prisma.account.findMany({
        where: accountWhere,
        select: {
          id: true,
          code: true,
          arabicName: true,
          englishName: true,
          accountType: true,
          currencyCode: true,
          journalEntryLines: {
            where: lineWhere,
            select: { debitBase: true, creditBase: true, debit: true, credit: true },
          },
        },
        orderBy: { code: 'asc' },
      });

      const allAccountBalances = accounts
        .map((account) => {
          const debit = account.journalEntryLines.reduce(
            (sum, line) => sum + Number(line.debitBase || line.debit || 0),
            0
          );
          const credit = account.journalEntryLines.reduce(
            (sum, line) => sum + Number(line.creditBase || line.credit || 0),
            0
          );
          const net = credit - debit;
          return {
            account: {
              id: account.id,
              code: account.code,
              arabicName: account.arabicName,
              englishName: account.englishName,
              accountType: account.accountType,
              currencyCode: account.currencyCode,
            },
            creditBalance: net > 0 ? net : 0,
            debitBalance: net < 0 ? Math.abs(net) : 0,
          };
        })
        .filter((row) => row.creditBalance > 0 || row.debitBalance > 0)
        .sort((a, b) => b.creditBalance + b.debitBalance - (a.creditBalance + a.debitBalance));

      // M16 fix (Item 35): `total`/`totalPages` were computed from the
      // already-sliced page array (always <= `limit`), so callers could
      // never tell there was more than one page. Compute pagination
      // metadata (and the summary) from the full filtered set, and slice
      // only the `data` returned.
      const total = allAccountBalances.length;
      const accountBalances = allAccountBalances.slice((page - 1) * limit, page * limit);

      return {
        data: accountBalances,
        summary: {
          totalCreditBalance: allAccountBalances.reduce((sum, acc) => sum + acc.creditBalance, 0),
          totalDebitBalance: allAccountBalances.reduce((sum, acc) => sum + acc.debitBalance, 0),
          totalAccounts: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
      const { companyId, safeId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
      };

      if (safeId) where.safeId = safeId;
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [treasuryReceipts, treasuryPayments, totalReceipts, totalPayments] = await Promise.all([
        prisma.treasuryReceipt.findMany({
          where: {
            ...where,
            safeId: safeId ? safeId : undefined,
          },
          skip,
          take: limit,
          include: {
            safe: true,
            account: true,
          },
          orderBy: { date: 'desc' },
        }),
        prisma.treasuryPayment.findMany({
          where: {
            ...where,
            safeId: safeId ? safeId : undefined,
          },
          skip,
          take: limit,
          include: {
            safe: true,
            account: true,
          },
          orderBy: { date: 'desc' },
        }),
        prisma.treasuryReceipt.count({
          where: {
            ...where,
            safeId: safeId ? safeId : undefined,
          },
        }),
        prisma.treasuryPayment.count({
          where: {
            ...where,
            safeId: safeId ? safeId : undefined,
          },
        }),
      ]);

      const totalReceiptsAmount = treasuryReceipts.reduce(
        (sum, receipt) => sum + Number(receipt.amount || 0),
        0
      );
      const totalPaymentsAmount = treasuryPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
      );

      const data = [
        ...treasuryReceipts.map((receipt) => ({
          type: 'قبض',
          date: receipt.date,
          voucherNumber: receipt.voucherNumber,
          description: receipt.description,
          amount: Number(receipt.amount || 0),
          currencyCode: receipt.currencyCode,
          safe: receipt.safe,
          account: receipt.account,
        })),
        ...treasuryPayments.map((payment) => ({
          type: 'صرف',
          date: payment.date,
          voucherNumber: payment.voucherNumber,
          description: payment.description,
          amount: Number(payment.amount || 0),
          currencyCode: payment.currencyCode,
          safe: payment.safe,
          account: payment.account,
        })),
      ].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      return {
        data,
        summary: {
          totalReceipts: totalReceiptsAmount,
          totalPayments: totalPaymentsAmount,
          netBalance: totalReceiptsAmount - totalPaymentsAmount,
        },
        pagination: {
          page,
          limit,
          total: totalReceipts + totalPayments,
          totalPages: Math.ceil((totalReceipts + totalPayments) / limit),
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
      const { companyId, fromDate, toDate } = filters;
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
      };

      const skip = (page - 1) * limit;

      const chequeWhere: any = {
        companyId,
        OR: [
          { dueDate: { gte: fromDate, lte: toDate } },
          { createdAt: { gte: fromDate, lte: toDate } },
        ],
      };

      const [receipts, payments, cheques, totalReceipts, totalPayments, totalCheques] = await Promise.all([
        prisma.treasuryReceipt.findMany({
          where,
          skip,
          take: limit,
          include: {
            safe: true,
            bankAccount: true,
            account: true,
          },
          orderBy: { date: 'desc' },
        }),
        prisma.treasuryPayment.findMany({
          where,
          skip,
          take: limit,
          include: {
            safe: true,
            bankAccount: true,
            account: true,
          },
          orderBy: { date: 'desc' },
        }),
        prisma.cheque.findMany({
          where: chequeWhere,
          include: {
            customer: { select: { id: true, code: true, arabicName: true } },
            supplier: { select: { id: true, code: true, arabicName: true } },
            bankAccount: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.treasuryReceipt.count({ where }),
        prisma.treasuryPayment.count({ where }),
        prisma.cheque.count({ where: chequeWhere }),
      ]);

      const allPapers = [
        ...receipts.map((r) => ({
          type: 'قبض',
          date: r.date,
          voucherNumber: r.voucherNumber,
          description: r.description,
          amount: Number(r.amount || 0),
          account: r.account,
          safe: r.safe,
          bankAccount: r.bankAccount,
        })),
        ...payments.map((p) => ({
          type: 'صرف',
          date: p.date,
          voucherNumber: p.voucherNumber,
          description: p.description,
          amount: Number(p.amount || 0),
          account: p.account,
          safe: p.safe,
          bankAccount: p.bankAccount,
        })),
        ...cheques.map((cheque) => ({
          type: cheque.direction === 'INWARD' ? 'شيك قبض' : 'شيك صرف',
          date: cheque.dueDate || cheque.createdAt,
          voucherNumber: cheque.chequeNumber,
          description: cheque.description || cheque.bankName,
          amount: Number(cheque.amount || 0),
          customer: cheque.customer,
          supplier: cheque.supplier,
          bankAccount: cheque.bankAccount,
          status: cheque.status,
        })),
      ].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      return {
        data: allPapers.slice((page - 1) * limit, page * limit),
        summary: {
          totalReceipts: totalReceipts,
          totalPayments: totalPayments,
          totalCheques,
        },
        pagination: {
          page,
          limit,
          total: totalReceipts + totalPayments + totalCheques,
          totalPages: Math.ceil((totalReceipts + totalPayments + totalCheques) / limit),
        },
      };
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
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        isPosted: false, // Temp receipts are not posted
      };

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [receipts, total] = await Promise.all([
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
      ]);

      const totalAmount = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

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
        isPosted: true,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
      }

      const skip = (page - 1) * limit;

      const [receipts, total] = await Promise.all([
        prisma.treasuryReceipt.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            supplier: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            account: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            safe: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            bankAccount: {
              select: {
                id: true,
                code: true,
                arabicName: true,
                bank: {
                  select: {
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.treasuryReceipt.count({ where }),
      ]);

      const totalCollections = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

      return {
        data: receipts,
        summary: {
          totalCollections,
          totalReceipts: total,
          byType: {
            cash: receipts.filter((r) => r.receiptType === 'cash').length,
            bank: receipts.filter((r) => r.receiptType === 'bank').length,
            safe: receipts.filter((r) => r.receiptType === 'safe').length,
            party: receipts.filter((r) => r.receiptType === 'party').length,
          },
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
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
      const { companyId, fromDate, toDate, branchId } = filters;
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

      const where: any = {
        companyId,
        ...dateFilter,
        isCancelled: false,
      };

      if (branchId) {
        where.branchId = branchId;
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
          where,
          include: {
            customer: { select: { id: true, code: true, arabicName: true } },
            supplier: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.securitiesPayment.findMany({
          where,
          include: {
            customer: { select: { id: true, code: true, arabicName: true } },
            supplier: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.securitiesRenewal.findMany({
          where: {
            companyId,
            ...dateFilter,
            isCancelled: false,
            ...(branchId ? { branchId } : {}),
          },
          orderBy: { date: 'desc' },
        }),
        prisma.cheque.findMany({
          where: {
            companyId,
            ...(branchId ? { branchId } : {}),
            ...chequeDateFilter,
          },
          include: {
            customer: { select: { id: true, code: true, arabicName: true } },
            supplier: { select: { id: true, code: true, arabicName: true } },
            bankAccount: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const financialPapers = [
        ...cheques.map((cheque) => ({
          id: cheque.id,
          type: cheque.direction === 'INWARD' ? 'شيك قبض' : 'شيك صرف',
          serial: cheque.chequeNumber,
          date: cheque.dueDate || cheque.createdAt,
          amount: Number(cheque.amount || 0),
          description: cheque.description || cheque.bankName,
          customer: cheque.customer,
          supplier: cheque.supplier,
          bankAccount: cheque.bankAccount,
          status: cheque.status,
        })),
        ...securitiesReceipts.map((sr) => ({
          id: sr.id,
          type: 'ورقة قبض',
          serial: sr.serial || sr.receiptNumber || sr.securityNumber,
          date: sr.date,
          amount: Number(sr.amount || 0),
          description: sr.description,
          customer: sr.customer,
          supplier: sr.supplier,
          status: sr.isPosted ? 'POSTED' : 'DRAFT',
        })),
        ...securitiesPayments.map((sp) => ({
          id: sp.id,
          type: 'ورقة دفع',
          serial: sp.serial || sp.paymentNumber || sp.securityNumber,
          date: sp.date,
          amount: Number(sp.amount || 0),
          description: sp.description,
          customer: sp.customer,
          supplier: sp.supplier,
          status: sp.isPosted ? 'POSTED' : 'DRAFT',
        })),
        ...securitiesRenewals.map((srn) => ({
          id: srn.id,
          type: 'تجديد',
          serial: srn.serial || srn.renewalNumber,
          date: srn.date,
          amount: Number(srn.newAmount || 0),
          description: srn.description,
          status: srn.isPosted ? 'POSTED' : 'DRAFT',
        })),
      ].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      const skip = (page - 1) * limit;
      const paginatedData = financialPapers.slice(skip, skip + limit);

      const totalAmount = financialPapers.reduce((sum, paper) => sum + paper.amount, 0);

      return {
        data: paginatedData,
        summary: {
          totalPapers: financialPapers.length,
          totalAmount,
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

export const reportsService = new ReportsService();

