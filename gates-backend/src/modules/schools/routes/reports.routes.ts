import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { schoolsReportsService, ReportNotImplementedError } from '../services/reports.service';
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
 * Wave 6 fix: the ten report methods backed by `ReportNotImplementedError`
 * used to return `{ data: [], summary: {} }` with a 200, indistinguishable
 * from a real "no rows matched" result. Surface it as 501 instead so callers
 * (and the frontend's error toasts) can tell "not built yet" apart from
 * "empty".
 */
function respondReportError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ReportNotImplementedError) {
    return void res.status(501).json({ status: 'error', message: error.message });
  }
  logger.error({ error }, fallbackMessage);
  return void res.status(500).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}

/**
 * GET /api/v1/schools/reports/student-report
 * Get Student Report
 */
router.get(
  '/student-report',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        studentId: req.query.studentId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        includeDetails: req.query.includeDetails !== 'false',
        includeSummary: req.query.includeSummary !== 'false',
      };

      const result = await schoolsReportsService.getStudentReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting student report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get student report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/payment-report
 * Get Payment Report
 */
router.get(
  '/payment-report',
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
        studentId: req.query.studentId as string | undefined,
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        includeDetails: req.query.includeDetails !== 'false',
        includeSummary: req.query.includeSummary !== 'false',
      };

      const result = await schoolsReportsService.getPaymentReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting payment report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get payment report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/detailed-payments
 * Get Detailed Payments Report
 */
router.get(
  '/detailed-payments',
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
        studentId: req.query.studentId as string | undefined,
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getDetailedPaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting detailed payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get detailed payments report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/analytical-education-payments
 * Get Analytical Education Payments Report
 */
router.get(
  '/analytical-education-payments',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      // M16 fix (Item 35): page/limit were never read from the query string,
      // so the service always fell back to its default limit=1000.
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await schoolsReportsService.getAnalyticalEducationPaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting analytical education payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get analytical education payments report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/analytical-activity-payments
 * Get Analytical Activity Payments Report
 */
router.get(
  '/analytical-activity-payments',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      // M16 fix (Item 35): page/limit were never read from the query string,
      // so the service always fell back to its default limit=1000.
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await schoolsReportsService.getAnalyticalActivityPaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting analytical activity payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get analytical activity payments report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/analytical-car-payments
 * Get Analytical Car Payments Report
 */
router.get(
  '/analytical-car-payments',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const result = await schoolsReportsService.getAnalyticalCarPaymentsReport(filters);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting analytical car payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get analytical car payments report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/analytical-books-payments
 * Get Analytical Books Payments Report
 */
router.get(
  '/analytical-books-payments',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      // M16 fix (Item 35): page/limit were never read from the query string,
      // so the service always fell back to its default limit=1000.
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await schoolsReportsService.getAnalyticalBooksPaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting analytical books payments report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get analytical books payments report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/consolidated-education-dues
 * Get Consolidated Education Dues Report
 */
router.get(
  '/consolidated-education-dues',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        asOfDate: req.query.asOfDate ? parseRangeEnd(req.query.asOfDate, 'asOfDate') : todayEndOfDayUtc(),
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
      };

      const result = await schoolsReportsService.getConsolidatedEducationDuesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting consolidated education dues report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get consolidated education dues report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/academic-discount
 * Get Academic Discount Report
 */
router.get(
  '/academic-discount',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAcademicDiscountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting academic discount report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get academic discount report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/bus-discount
 * Get Bus Discount Report
 */
router.get(
  '/bus-discount',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getBusDiscountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting bus discount report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bus discount report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/discounts-report
 * Get Discounts Report
 */
router.get(
  '/discounts-report',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getDiscountsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting discounts report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get discounts report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/students-data
 * Get Students Data Report
 */
router.get(
  '/students-data',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        studentId: req.query.studentId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getStudentsDataReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting students data report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get students data report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/cash-receipt-report
 * Get Cash Receipt Report
 */
router.get(
  '/cash-receipt-report',
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

      const result = await schoolsReportsService.getCashReceiptReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting cash receipt report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get cash receipt report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/aggregated-activity-dues
 * Get Aggregated Activity Dues Report
 */
router.get(
  '/aggregated-activity-dues',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAggregatedActivityDuesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get aggregated activity dues report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/aggregated-books-dues
 * Get Aggregated Books Dues Report
 */
router.get(
  '/aggregated-books-dues',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAggregatedBooksDuesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get aggregated books dues report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/aggregated-car-dues
 * Get Aggregated Car Dues Report
 */
router.get(
  '/aggregated-car-dues',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAggregatedCarDuesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting aggregated car dues report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get aggregated car dues report',
      });
    }
  }
);

/**
 * GET /api/v1/schools/reports/aggregated-other-dues
 * Get Aggregated Other Dues Report
 */
router.get(
  '/aggregated-other-dues',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAggregatedOtherDuesReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get aggregated other dues report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/analytical-other-payments
 * Get Analytical Other Payments Report
 */
router.get(
  '/analytical-other-payments',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getAnalyticalOtherPaymentsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get analytical other payments report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/other-discount
 * Get Other Discount Report
 */
router.get(
  '/other-discount',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getOtherDiscountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get other discount report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/partner-discount
 * Get Partner Discount Report
 */
router.get(
  '/partner-discount',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getPartnerDiscountReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get partner discount report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/partner-children-discounts
 * Get Partner Children Discounts Report
 */
router.get(
  '/partner-children-discounts',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getPartnerChildrenDiscountsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get partner children discounts report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/sibling-discounts
 * Get Sibling Discounts Report
 */
router.get(
  '/sibling-discounts',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getSiblingDiscountsReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get sibling discounts report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/management-shares-activity
 * Get Management Shares Activity Report
 */
router.get(
  '/management-shares-activity',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getManagementSharesActivityReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get management shares activity report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/project-support-fund
 * Get Project Support Fund Report
 */
router.get(
  '/project-support-fund',
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
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        fromDate: req.query.fromDate ? parseRangeStart(req.query.fromDate, 'fromDate') : undefined,
        toDate: req.query.toDate ? parseRangeEnd(req.query.toDate, 'toDate') : undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getProjectSupportFundReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      return respondReportError(res, error, 'Failed to get project support fund report');
    }
  }
);

/**
 * GET /api/v1/schools/reports/installment-payments
 * Get Installment Payment Report
 */
router.get(
  '/installment-payments',
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
        studentId: req.query.studentId as string | undefined,
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        branchId: req.query.branchId as string | undefined,
      };

      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      };

      const result = await schoolsReportsService.getInstallmentPaymentReport(filters, options);

      return void res.json({
        status: 'success',
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting installment payment report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get installment payment report',
      });
    }
  }
);

export default router;

