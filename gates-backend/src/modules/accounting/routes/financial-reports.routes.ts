import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { financialReportService } from '../services/financial-report.service';
import { agedOpenItemsService } from '../services/aged-open-items.service';
import { inventoryGlReconciliationService } from '../services/inventory-gl-reconciliation.service';
import { partyBalanceReconciliationService } from '../services/party-balance-reconciliation.service';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

// M15 fix: range starts use start-of-day, range ends/as-of dates use
// end-of-day — a same-day filter (or `asOfDate=today`) must include every
// entry posted that calendar day, not just ones at exactly UTC midnight.
function parseDate(value: unknown, field: string): Date {
  try {
    return endOfDayUtc(value, field);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : `Invalid ${field}`);
  }
}

function parseRangeStart(value: unknown, field: string): Date {
  try {
    return startOfDayUtc(value, field);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : `Invalid ${field}`);
  }
}

function baseParams(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return {
    companyId,
    branchId: (req.query.branchId as string) || undefined,
    fiscalYearId: (req.query.fiscalYearId as string) || req.fiscalYearId || undefined,
    costCenterId: (req.query.costCenterId as string) || undefined,
    createdBy: (req.query.userId as string) || undefined,
    includeUnposted: req.query.showUnposted === 'true',
    withBudgetOnly: req.query.withBudgetOnly === 'true',
  };
}

router.get(
  '/trial-balance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await financialReportService.getTrialBalance({
        ...baseParams(req),
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseDate(req.query.endDate ?? req.query.toDate, 'endDate'),
        level: req.query.level ? parseInt(String(req.query.level), 10) : undefined,
        accountId: String(req.query.accountId ?? '').trim() || undefined,
        currencyId: String(req.query.currencyId ?? '').trim() || undefined,
        fromVoucher: req.query.fromVoucher ? Number(req.query.fromVoucher) : undefined,
        toVoucher: req.query.toVoucher ? Number(req.query.toVoucher) : undefined,
        showIdleAccounts: req.query.showIdleAccounts === 'true',
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Trial balance failed',
      });
    }
  }
);

router.get(
  '/account-statement/:accountId',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const levelRaw = req.query.level ? parseInt(String(req.query.level), 10) : undefined;
      const data = await financialReportService.getAccountStatement({
        ...baseParams(req),
        accountId: req.params.accountId,
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseDate(req.query.endDate ?? req.query.toDate, 'endDate'),
        level: levelRaw && levelRaw > 0 ? levelRaw : undefined,
        description: String(req.query.description ?? '').trim() || undefined,
        counterpartAccountId: String(req.query.counterpartAccountId ?? '').trim() || undefined,
        currencyId: String(req.query.currencyId ?? '').trim() || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Account statement failed',
      });
    }
  }
);

router.get(
  '/cost-center-statement/:costCenterId',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const levelRaw = req.query.level ? parseInt(String(req.query.level), 10) : undefined;
      const data = await financialReportService.getCostCenterStatement({
        ...baseParams(req),
        costCenterId: req.params.costCenterId,
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseDate(req.query.endDate ?? req.query.toDate, 'endDate'),
        level: levelRaw && levelRaw > 0 ? levelRaw : undefined,
        description: String(req.query.description ?? '').trim() || undefined,
        counterpartAccountId: String(req.query.counterpartAccountId ?? '').trim() || undefined,
        currencyId: String(req.query.currencyId ?? '').trim() || undefined,
        accountId: String(req.query.accountId ?? '').trim() || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Cost center statement failed',
      });
    }
  }
);

router.get(
  '/income-statement',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await financialReportService.getIncomeStatement({
        ...baseParams(req),
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseDate(req.query.endDate ?? req.query.toDate, 'endDate'),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Income statement failed',
      });
    }
  }
);

router.get(
  '/monthly-performance',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new AppError(400, 'السنة غير صالحة');
      }
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new AppError(400, 'الشهر غير صالح');
      }
      const data = await financialReportService.getMonthlyPerformance({
        companyId: baseParams(req).companyId,
        branchId: (req.query.branchId as string) || undefined,
        costCenterId: (req.query.costCenterId as string) || undefined,
        year,
        month,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Monthly performance failed',
      });
    }
  }
);

router.get(
  '/cost-center-profitability',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError(400, 'السنة غير صالحة');
      if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError(400, 'الشهر غير صالح');
      const scope = baseParams(req);
      const data = await financialReportService.getCostCenterProfitability({
        companyId: scope.companyId,
        branchId: scope.branchId,
        year,
        month,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Cost center profitability failed',
      });
    }
  }
);

router.get(
  '/balance-sheet',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await financialReportService.getBalanceSheet({
        ...baseParams(req),
        asOfDate: parseDate(req.query.asOfDate ?? req.query.toDate, 'asOfDate'),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Balance sheet failed',
      });
    }
  }
);

router.get(
  '/cash-flow',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await financialReportService.getCashFlowStatement({
        ...baseParams(req),
        startDate: parseRangeStart(req.query.startDate ?? req.query.fromDate, 'startDate'),
        endDate: parseDate(req.query.endDate ?? req.query.toDate, 'endDate'),
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Cash flow statement failed',
      });
    }
  }
);

router.get(
  '/cost-center-summary',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await financialReportService.getCostCenterReport({
        ...baseParams(req),
        startDate: parseRangeStart(req.query.startDate, 'startDate'),
        endDate: parseDate(req.query.endDate, 'endDate'),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Cost center summary failed',
      });
    }
  }
);

router.get(
  '/aged-receivables',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await agedOpenItemsService.getAgedReceivables({
        ...baseParams(req),
        asOfDate: parseDate(req.query.asOfDate ?? req.query.toDate, 'asOfDate'),
        customerId: (req.query.customerId as string) || undefined,
        customerCategoryId: (req.query.customerCategoryId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Aged receivables failed',
      });
    }
  }
);

router.get(
  '/aged-payables',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await agedOpenItemsService.getAgedPayables({
        ...baseParams(req),
        asOfDate: parseDate(req.query.asOfDate ?? req.query.toDate, 'asOfDate'),
        supplierId: (req.query.supplierId as string) || undefined,
        supplierCategoryId: (req.query.supplierCategoryId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Aged payables failed',
      });
    }
  }
);

router.get(
  '/inventory-gl-reconciliation',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = baseParams(req);
      const data = await inventoryGlReconciliationService.getReconciliation({
        companyId,
        warehouseId: (req.query.warehouseId as string) || undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Inventory-GL reconciliation failed',
      });
    }
  }
);

router.get(
  '/party-balance-reconciliation',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = baseParams(req);
      const data = await partyBalanceReconciliationService.getReconciliation(companyId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Party balance reconciliation failed',
      });
    }
  }
);

router.post(
  '/party-balance-reconciliation/resync',
  authorize({ resource: 'report', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = baseParams(req);
      const partyType = req.body?.partyType as 'customer' | 'supplier' | undefined;
      const partyId = req.body?.partyId as string | undefined;
      const data = await partyBalanceReconciliationService.resyncCache(companyId, { partyType, partyId });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Party balance resync failed',
      });
    }
  }
);

export default router;
