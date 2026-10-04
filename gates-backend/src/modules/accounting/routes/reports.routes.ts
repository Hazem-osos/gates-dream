import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { reportsQueue } from '../../../workers/queues/reports.queue';
import { enqueueJob, ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';
import { respondAcceptedJob } from '../../../shared/jobs/accept-job';
import { reportsService } from '../services/reports.service';
import { financialReportService } from '../services/financial-report.service';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';
import { partyGroupFromQuery } from '../services/party-group-filter';
import { requireRedisEnabled } from '../../../shared/jobs/require-redis';

const router = Router();

/**
 * @deprecated Legacy report handlers load journal rows into Node for aggregation.
 * Prefer `/api/v1/accounting/financial-reports/*` (M16 SQL aggregates) for new UI work.
 */
router.use(authenticate);
router.use(setTenantContext);

// M15 fix: these legacy routes used to do a bare `new Date(queryString)` for
// every date-only filter, so a `toDate=2026-08-21` (or an omitted `toDate`
// defaulting to `new Date()`) meant "up to exactly UTC midnight" — silently
// dropping every entry posted later that same calendar day. Range starts now
// floor to UTC midnight and range ends/`asOfDate`/default-"today" ceil to the
// last instant of that UTC day, matching the M16 financial-reports routes.
function parseRangeStart(value: unknown, field: string): Date {
  return startOfDayUtc(value, field);
}
function parseRangeEnd(value: unknown, field: string): Date {
  return endOfDayUtc(value, field);
}
function todayEndOfDayUtc(): Date {
  return endOfDayUtc(new Date().toISOString().split('T')[0], 'today');
}

function reportQueryFlags(req: AuthRequest) {
  return {
    showUnposted: req.query.showUnposted === 'true',
    withBudgetOnly: req.query.withBudgetOnly === 'true',
  };
}

/**
 * POST /api/v1/accounting/reports/generate
 * Enqueue report generation job
 */
router.post(
  '/generate',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!requireRedisEnabled(res)) return;

      const { reportType, reportName, filters, email } = req.body;
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || '';

      if (!reportType || !reportName) {
        return void res.status(400).json({
          status: 'error',
          message: 'reportType and reportName are required',
        });
      }

      if (!['pdf', 'excel', 'csv'].includes(reportType)) {
        return void res.status(400).json({
          status: 'error',
          message: 'reportType must be pdf, excel, or csv',
        });
      }

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const job =
        reportType === 'pdf'
          ? await enqueueJob(
              ASYNC_QUEUE_NAMES.PDF_GENERATION,
              'report-pdf',
              {
                companyId,
                userId,
                kind: 'report' as const,
                reportName,
                filters: filters || {},
                email,
              },
              { priority: 1 }
            )
          : await enqueueJob(
              ASYNC_QUEUE_NAMES.REPORT_EXPORT,
              'report-export',
              {
                companyId,
                userId,
                reportType,
                reportName,
                filters: filters || {},
                email,
              },
              { priority: 2 }
            );

      logger.info(
        { jobId: job.id, companyId, reportType, reportName },
        'Report generation job enqueued'
      );

      return void respondAcceptedJob(res, job, 'Report generation job enqueued');
    } catch (error) {
      logger.error({ error }, 'Error enqueuing report job');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to enqueue report generation job',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/general-ledger
 * Get General Ledger report
 */
router.get(
  '/general-ledger',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        accountId: req.query.accountId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        includeDetails: req.query.includeDetails !== 'false',
      };

      const result = await reportsService.getGeneralLedger(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting general ledger report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get general ledger report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/daily-journal
 * Get Daily Journal report
 */
router.get(
  '/daily-journal',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        accountId: req.query.accountId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
        description: req.query.description as string | undefined,
        fromVoucher: req.query.fromVoucher as string | undefined,
        toVoucher: req.query.toVoucher as string | undefined,
        accountView: req.query.accountView as string | undefined,
        amountOp: req.query.amountOp as string | undefined,
        amount: req.query.amount as string | undefined,
        amountTo: req.query.amountTo as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await reportsService.getDailyJournal(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting daily journal report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get daily journal report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/cost-center-ledger
 * Get Cost Center Ledger report
 */
router.get(
  '/cost-center-ledger',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getCostCenterLedger(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost center ledger report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost center ledger report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/balance-sheet
 * Get Balance Sheet report
 */
router.get(
  '/balance-sheet',
  authorize({ resource: 'report', action: 'view' }),
  (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        'Legacy balance sheet removed. Use GET /api/v1/accounting/reports/balance-sheet from financial-report (M16).',
    });
  }
);

/**
 * GET /api/v1/accounting/reports/income-statement
 * Get Income Statement report
 */
router.get(
  '/income-statement',
  authorize({ resource: 'report', action: 'view' }),
  (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        'Legacy income statement removed. Use GET /api/v1/accounting/reports/income-statement from financial-report (M16).',
    });
  }
);

/**
 * GET /api/v1/accounting/reports/account-analysis
 * Get Account Analysis report
 */
router.get(
  '/account-analysis',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        accountId: req.query.accountId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getAccountAnalysis(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting account analysis report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get account analysis report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/credit-aging
 * Get Credit Aging report
 */
router.get(
  '/credit-aging',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        customerId: req.query.customerId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        asOfDate: req.query.asOfDate ? parseRangeEnd(req.query.asOfDate, 'asOfDate') : todayEndOfDayUtc(),
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getCreditAging(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting credit aging report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get credit aging report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/review-balance
 * Get Review Balance (Accounts Balance) report
 */
router.get(
  '/review-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await reportsService.getReviewBalance(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting review balance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get review balance report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/accounts-balance
 * Get Accounts Balance report (alias for review-balance)
 */
router.get(
  '/accounts-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const trial = await financialReportService.getTrialBalance({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        costCenterId: (req.query.costCenterId as string) || undefined,
        accountId: String(req.query.accountId ?? '').trim() || undefined,
        startDate: req.query.fromDate
          ? parseRangeStart(req.query.fromDate, 'fromDate')
          : parseRangeStart('1970-01-01', 'fromDate'),
        endDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : todayEndOfDayUtc(),
        includeUnposted: req.query.showUnposted === 'true',
        withBudgetOnly: req.query.withBudgetOnly === 'true',
      });

      return void res.json({
        status: 'success',
        data: trial.accounts,
        summary: trial.verification,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting accounts balance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get accounts balance report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/cost-centers-balance
 * Get Cost Centers Balance report
 */
router.get(
  '/cost-centers-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : todayEndOfDayUtc(),
        costCenterId: req.query.costCenterId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await reportsService.getCostCentersBalance(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost centers balance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost centers balance report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/trading-account
 * Get Trading Account report
 */
router.get(
  '/trading-account',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        costCenterId: (req.query.costCenterId as string) || undefined,
      };

      if (!filters.fromDate || !filters.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const result = await reportsService.getTradingAccount(filters);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting trading account report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get trading account report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/profit-loss
 * Get Profit & Loss report
 */
router.get(
  '/profit-loss',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const data = await financialReportService.getIncomeStatement({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        fiscalYearId: (req.query.fiscalYearId as string) || req.fiscalYearId || undefined,
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseRangeEnd(req.query.endDate ?? req.query.toDate, 'endDate'),
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Income statement failed',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/bank-movement
 * Get Bank Movement report
 */
router.get(
  '/bank-movement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        accountId: req.query.accountId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      if (!filters.fromDate || !filters.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 5000,
      };

      const result = await reportsService.getBankMovement(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting bank movement report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bank movement report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/bank-monthly-statement
 * Monthly bank sheet: receipts on the right, payments on the left.
 */
router.get(
  '/bank-monthly-statement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const filters = {
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        accountId: req.query.accountId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };
      const result = await reportsService.getBankMonthlyStatement(filters);
      return void res.json({ status: 'success', data: result.data });
    } catch (error) {
      logger.error({ error }, 'Error getting bank monthly statement');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bank monthly statement',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/cash-flow
 * H20 fix: replaced by the real indirect-method statement — this route is
 * shadowed anyway since `financialReportsRoutes` is mounted first at the
 * same `/accounting/reports` prefix and now also registers `/cash-flow`,
 * but kept explicit (like balance-sheet/income-statement above) so it's
 * clear the legacy direct-listing implementation was intentionally retired.
 */
router.get(
  '/cash-flow',
  authorize({ resource: 'report', action: 'view' }),
  (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        'Legacy cash flow report removed. Use GET /api/v1/accounting/reports/cash-flow from financial-report (M16).',
    });
  }
);

/**
 * GET /api/v1/accounting/reports/unposted-operations
 * Get Unposted Operations report
 */
router.get(
  '/unposted-operations',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        accountId: req.query.accountId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getUnpostedOperations(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting unposted operations report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get unposted operations report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/suppliers-balances
 * Get Suppliers Balances report
 */
router.get(
  '/suppliers-balances',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        asOfDate: req.query.asOfDate
          ? parseRangeEnd(req.query.asOfDate, 'asOfDate')
          : req.query.toDate
            ? parseRangeEnd(req.query.toDate, 'toDate')
            : todayEndOfDayUtc(),
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getSuppliersBalances(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting suppliers balances report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get suppliers balances report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/financial-position-statement
 * Get Financial Position Statement report
 */
router.get(
  '/financial-position-statement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const data = await financialReportService.getBalanceSheet({
        companyId,
        branchId: (req.query.branchId as string) || undefined,
        fiscalYearId: (req.query.fiscalYearId as string) || req.fiscalYearId || undefined,
        asOfDate: parseRangeEnd(req.query.asOfDate ?? req.query.toDate, 'asOfDate'),
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Balance sheet failed',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/monthly-review-balance
 * Get Monthly Review Balance report
 */
router.get(
  '/monthly-review-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const year = req.query.year as string | undefined;
      const month = req.query.month as string | undefined;
      let fromDate = req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined;
      let toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;

      if ((!fromDate || !toDate) && year && month) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
          return void res.status(400).json({
            status: 'error',
            message: 'الشهر أو السنة غير صالحين',
          });
        }
        const monthKey = String(m).padStart(2, '0');
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        fromDate = fromDate ?? parseRangeStart(`${y}-${monthKey}-01`, 'fromDate');
        toDate = toDate ?? parseRangeEnd(`${y}-${monthKey}-${String(lastDay).padStart(2, '0')}`, 'toDate');
      }

      if (!fromDate || !toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'يرجى اختيار تاريخ البداية والنهاية',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate,
        toDate,
        branchId: req.query.branchId as string | undefined,
        showIdleAccounts: req.query.showIdleAccounts === 'true',
      };

      const result = await reportsService.getMonthlyReviewBalance(filters);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
        period: { year, month, fromDate, toDate },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting monthly review balance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get monthly review balance report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/cancelled-operations
 * Get Cancelled Operations report
 */
router.get(
  '/cancelled-operations',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        accountId: req.query.accountId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getCancelledOperations(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cancelled operations report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cancelled operations report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/jobs/:jobId
 * Get job status
 */
router.get(
  '/jobs/:jobId',
  authorize({ resource: 'report', action: 'view' }),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = await reportsQueue.getJob(jobId);

      if (!job) {
        return void res.status(404).json({
          status: 'error',
          message: 'Job not found',
        });
      }

      const state = await job.getState();
      const progress = await job.progress;
      const result = await job.returnvalue;
      const failedReason = await job.failedReason;

      return void res.json({
        jobId: job.id,
        state,
        progress,
        result,
        failedReason,
        createdAt: new Date(job.timestamp),
      });
    } catch (error) {
      logger.error({ error }, 'Error getting job status');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to get job status',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/cost-center-balance
 * Get Cost Center Balance (Single Cost Center)
 */
router.get(
  '/cost-center-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        costCenterId: (req.query.costCenterId as string) || undefined,
        accountId: (req.query.accountId as string) || undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await reportsService.getCostCenterBalance(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost center balance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost center balance report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/budget
 * Get Budget Report
 */
router.get(
  '/budget',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        accountId: req.query.accountId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await reportsService.getBudgetReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting budget report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get budget report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/expenses-analysis
 * Get Expenses Analysis Report
 */
router.get(
  '/expenses-analysis',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        accountId: req.query.accountId as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 2000,
      };

      const result = await reportsService.getExpensesAnalysis(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting expenses analysis report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get expenses analysis report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/operations-analysis
 * Get Operations Analysis Report
 */
router.get(
  '/operations-analysis',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getOperationsAnalysis(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting operations analysis report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get operations analysis report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/account-balances-credit
 * Get Account Balances (Credit section)
 */
router.get(
  '/account-balances-credit',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
        accountId: (req.query.accountId as string) || undefined,
        costCenterId: (req.query.costCenterId as string) || undefined,
        currencyId: (req.query.currencyId as string) || undefined,
        customerId: (req.query.customerId as string) || undefined,
        supplierId: (req.query.supplierId as string) || undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 5000,
      };

      const result = await reportsService.getAccountBalancesCredit(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting account balances credit report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get account balances credit report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/safe
 * Get Safe Report
 */
router.get(
  '/safe',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        safeId: req.query.safeId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        currencyId: req.query.currencyId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 5000,
      };

      const result = await reportsService.getSafeReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting safe report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get safe report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/financial-papers-flow
 * Get Financial Papers Flow Report
 */
router.get(
  '/financial-papers-flow',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        branchId: req.query.branchId as string | undefined,
        entityId: req.query.entityId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getFinancialPapersFlow(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting financial papers flow report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get financial papers flow report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/temp-receipts-report
 * Get Temp Receipts Report
 */
router.get(
  '/temp-receipts-report',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getTempReceiptsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting temp receipts report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get temp receipts report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/treasury-collections
 * Get Treasury Collections Report
 */
router.get(
  '/treasury-collections',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!req.query.fromDate || !req.query.toDate) {
        return void res.status(400).json({
          status: 'error',
          message: 'From date and to date are required',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        branchId: req.query.branchId as string | undefined,
        entityId: req.query.entityId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getTreasuryCollections(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting treasury collections report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get treasury collections report',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/reports/financial-papers
 * Get Financial Papers Report
 */
router.get(
  '/financial-papers',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const filters = {
        ...partyGroupFromQuery(req.query),
        companyId,
        ...reportQueryFlags(req),
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        branchId: req.query.branchId as string | undefined,
        entityId: req.query.entityId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await reportsService.getFinancialPapers(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting financial papers report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get financial papers report',
      });
    }
  }
);

export default router;
