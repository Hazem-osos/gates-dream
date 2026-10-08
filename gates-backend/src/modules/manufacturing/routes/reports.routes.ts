import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { manufacturingReportsService } from '../services/reports.service';
import { getProductionOrderStatusReport } from '../services/production-order-status-report.service';
import { getSalesOrderTrackingReport } from '../services/sales-order-tracking-report.service';
import { getWorkOrderTrackingReport } from '../services/work-order-tracking-report.service';
import { getProductionCommitmentsReport } from '../services/production-commitments-report.service';
import { getProductionCostPostingSummaryReport } from '../services/production-cost-posting-summary.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);

// M15 fix: see accounting/routes/reports.routes.ts — range starts floor to
// UTC midnight, range ends/asOfDate/default-"today" ceil to the last
// instant of that UTC day so same-day filters include the whole day.
function parseRangeStart(value: unknown, field: string): Date {
  return startOfDayUtc(value, field);
}
function parseRangeEnd(value: unknown, field: string): Date {
  return endOfDayUtc(value, field);
}
function todayEndOfDayUtc(): Date {
  return endOfDayUtc(new Date().toISOString().split('T')[0], 'today');
}

/**
 * GET /api/v1/manufacturing/reports/invoice-variance
 * Get Invoice Variance Report
 */
router.get(
  '/invoice-variance',
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
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await manufacturingReportsService.getInvoiceVarianceReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting invoice variance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get invoice variance report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/cost-variance
 * Get Cost Variance Report
 */
router.get(
  '/cost-variance',
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
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        bomId: req.query.bomId as string | undefined,
        stage: req.query.stage as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        showUnposted: req.query.showUnposted !== 'false',
        varianceTypes: req.query.varianceTypes as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await manufacturingReportsService.getCostVarianceReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cost variance report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost variance report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/manufacturing-movements
 * Get Manufacturing Movements Report
 */
router.get(
  '/manufacturing-movements',
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
        companyId,
        fromDate: parseRangeStart(req.query.fromDate, 'fromDate'),
        toDate: parseRangeEnd(req.query.toDate, 'toDate'),
        itemId: req.query.itemId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        bomId: req.query.bomId as string | undefined,
        stage: req.query.stage as string | undefined,
        costCenterId: req.query.costCenterId as string | undefined,
        showUnposted: req.query.showUnposted !== 'false',
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await manufacturingReportsService.getManufacturingMovementsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting manufacturing movements report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get manufacturing movements report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/order-status
 * مواقف أوامر التصنيع
 */
router.get(
  '/order-status',
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

      const fromDate = req.query.fromDate
        ? parseRangeStart(req.query.fromDate, 'fromDate')
        : undefined;
      const toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;

      const result = await getProductionOrderStatusReport({
        companyId,
        fromDate,
        toDate,
        status: (req.query.status as string) || undefined,
        bomId: (req.query.bomId as string) || undefined,
        warehouseIdRaw: (req.query.warehouseIdRaw as string) || undefined,
        warehouseIdFinished: (req.query.warehouseIdFinished as string) || undefined,
        orderNumber: (req.query.orderNumber as string) || undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting production order status report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get order status report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/theoretical-capability
 * Get Theoretical Capability Report
 */
router.get(
  '/theoretical-capability',
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
        companyId,
        warehouseId: req.query.warehouseId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await manufacturingReportsService.getTheoreticalCapabilityReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting theoretical capability report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get theoretical capability report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/sales-order-tracking
 */
router.get(
  '/sales-order-tracking',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const fromDate = req.query.fromDate
        ? parseRangeStart(req.query.fromDate, 'fromDate')
        : undefined;
      const toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;
      const result = await getSalesOrderTrackingReport({
        companyId,
        fromDate,
        toDate,
        invoiceNumber: (req.query.invoiceNumber as string) || undefined,
        customerId: (req.query.customerId as string) || undefined,
      });
      return void res.json({ status: 'success', data: result.data, summary: result.summary });
    } catch (error) {
      logger.error({ error }, 'sales-order-tracking report failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales order tracking report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/work-order-tracking
 */
router.get(
  '/work-order-tracking',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const fromDate = req.query.fromDate
        ? parseRangeStart(req.query.fromDate, 'fromDate')
        : undefined;
      const toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;
      const result = await getWorkOrderTrackingReport({
        companyId,
        fromDate,
        toDate,
        status: (req.query.status as string) || undefined,
        orderNumber: (req.query.orderNumber as string) || undefined,
      });
      return void res.json({ status: 'success', data: result.data, summary: result.summary });
    } catch (error) {
      logger.error({ error }, 'work-order-tracking report failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get work order tracking report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/production-commitments
 * لوحة التزامات الإنتاج والتسليم
 */
router.get(
  '/production-commitments',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const fromDate = req.query.fromDate
        ? parseRangeStart(req.query.fromDate, 'fromDate')
        : undefined;
      const toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;
      const result = await getProductionCommitmentsReport({
        companyId,
        fromDate,
        toDate,
        invoiceNumber: (req.query.invoiceNumber as string) || undefined,
        customerId: (req.query.customerId as string) || undefined,
        includeCompleted: req.query.includeCompleted === 'true',
      });
      return void res.json({ status: 'success', data: result.data, summary: result.summary });
    } catch (error) {
      logger.error({ error }, 'production-commitments report failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get production commitments report',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/reports/cost-posting-summary
 * ملخص تكاليف الإنتاج والترحيل المحاسبي
 */
router.get(
  '/cost-posting-summary',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const fromDate = req.query.fromDate
        ? parseRangeStart(req.query.fromDate, 'fromDate')
        : undefined;
      const toDate = req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined;
      const result = await getProductionCostPostingSummaryReport({
        companyId,
        fromDate,
        toDate,
        warehouseIdRaw: (req.query.warehouseIdRaw as string) || undefined,
        warehouseIdFinished: (req.query.warehouseIdFinished as string) || undefined,
        costCenter: (req.query.costCenter as string) || undefined,
        postedOnly: req.query.postedOnly === 'true',
      });
      return void res.json({ status: 'success', data: result.data, summary: result.summary });
    } catch (error) {
      logger.error({ error }, 'cost-posting-summary report failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cost posting summary report',
      });
    }
  }
);

export default router;

