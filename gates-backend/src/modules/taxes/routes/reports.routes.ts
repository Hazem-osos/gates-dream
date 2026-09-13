import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { taxReportsService } from '../services/reports.service';
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
 * GET /api/v1/taxes/reports/withholding-notifications
 * Get Withholding Notifications Report
 */
router.get(
  '/withholding-notifications',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        companyId,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        supplierId: req.query.supplierId as string | undefined,
        accountId: req.query.accountId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        includeDetails: req.query.includeDetails !== 'false',
      };

      const result = await taxReportsService.getWithholdingNotificationsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting withholding notifications report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get withholding notifications report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/canceled-withholding-notifications
 * Get Canceled Withholding Notifications Report
 */
router.get(
  '/canceled-withholding-notifications',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        companyId,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        supplierId: req.query.supplierId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getCanceledWithholdingNotificationsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting canceled withholding notifications report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get canceled withholding notifications report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/suppliers-ledger-withholding-tax
 * Get Suppliers Ledger Withholding Tax Report
 */
router.get(
  '/suppliers-ledger-withholding-tax',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        companyId,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        supplierId: req.query.supplierId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getSuppliersLedgerWithholdingTaxReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting suppliers ledger withholding tax report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get suppliers ledger withholding tax report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/withholding-tax-ledger-due-payment
 * Get Withholding Tax Ledger Due Payment Report
 */
router.get(
  '/withholding-tax-ledger-due-payment',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const filters = {
        companyId,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
        supplierId: req.query.supplierId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getWithholdingTaxLedgerDuePaymentReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting withholding tax ledger due payment report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get withholding tax ledger due payment report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/vat-declarations
 * Get VAT Declarations Report
 */
router.get(
  '/vat-declarations',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getVATDeclarationsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting VAT declarations report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get VAT declarations report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/vat-notifications
 * Get VAT Notifications Report
 */
router.get(
  '/vat-notifications',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getVATNotificationsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting VAT notifications report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get VAT notifications report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/form-41-inspection
 * Get Form 41 Inspection Report
 */
router.get(
  '/form-41-inspection',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getForm41InspectionReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting Form 41 inspection report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get Form 41 inspection report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/form-41-payment-receipts
 * Get Form 41 Payment Receipts Report
 */
router.get(
  '/form-41-payment-receipts',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getForm41PaymentReceiptsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting Form 41 payment receipts report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get Form 41 payment receipts report',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/reports/non-withholding-tax-payments-inspection
 * Get Non-Withholding Tax Payments Inspection Report
 */
router.get(
  '/non-withholding-tax-payments-inspection',
  authorize({ resource: 'report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await taxReportsService.getNonWithholdingTaxPaymentsInspectionReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting non-withholding tax payments inspection report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get non-withholding tax payments inspection report',
      });
    }
  }
);

export default router;

