import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { electronicInvoiceReportsService } from '../services/reports.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { startOfDayUtc, endOfDayUtc } from '../../../shared/utils/report-date';

const router = Router();

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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalId(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(text) ? text : undefined;
}

function patternIds(value: unknown): string[] | undefined {
  const raw = String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const ids = raw.filter((id) => id === 'builtin:SALES_INVOICE' || UUID_RE.test(id));
  return ids.length ? ids : undefined;
}

function submissionOf(value: unknown): 'sent' | 'unsent' | 'all' {
  return value === 'unsent' || value === 'all' || value === 'sent' ? value : 'sent';
}

function reportFilters(req: AuthRequest, companyId: string) {
  return {
    companyId,
    customerId: optionalId(req.query.customerId),
    delegateId: optionalId(req.query.delegateId),
    warehouseId: optionalId(req.query.warehouseId),
    branchId: optionalId(req.query.branchId),
    itemId: optionalId(req.query.itemId),
    itemGroupId: optionalId(req.query.itemGroupId),
    costCenterId: optionalId(req.query.costCenterId),
    sentByUserId: optionalId(req.query.sentByUserId),
    invoiceNumber: String(req.query.invoiceNumber ?? '').trim().slice(0, 50) || undefined,
    patternIds: patternIds(req.query.patternIds),
    submission: submissionOf(req.query.invoiceSelection),
    fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
    toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
    submittedFrom: req.query.submittedFrom
      ? parseRangeStart(req.query.submittedFrom, 'submittedFrom')
      : undefined,
    submittedTo: req.query.submittedTo
      ? parseRangeEnd(req.query.submittedTo, 'submittedTo')
      : undefined,
  };
}

/**
 * GET /api/v1/electronic-invoices/reports/sales-invoices
 * Get Sales Invoices Report
 */
router.get(
  '/sales-invoices',
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

      const filters = reportFilters(req, companyId);

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await electronicInvoiceReportsService.getSalesInvoicesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sales invoices report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get sales invoices report',
      });
    }
  }
);

/**
 * GET /api/v1/electronic-invoices/reports/returns-invoices
 * Get Returns Invoices Report
 */
router.get(
  '/returns-invoices',
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

      const filters = reportFilters(req, companyId);

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await electronicInvoiceReportsService.getReturnsInvoicesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting returns invoices report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get returns invoices report',
      });
    }
  }
);

/**
 * GET /api/v1/electronic-invoices/reports/modified-returns
 * Get Modified Returns Report
 */
router.get(
  '/modified-returns',
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

      const filters = reportFilters(req, companyId);

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await electronicInvoiceReportsService.getModifiedReturnsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting modified returns report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get modified returns report',
      });
    }
  }
);

export default router;

