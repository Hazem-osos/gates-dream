// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPOSSaleSchema,
  posSaleQuerySchema,
  dailyPOSReportQuerySchema,
} from '../schemas/pos.schema';
import { posService } from '../services/pos.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/pos/sales
 * Create a POS sale
 */
router.post(
  '/sales',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createPOSSaleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || '';

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const sale = await posService.createPOSSale(companyId, userId, req.body);

      logger.info({ companyId, saleId: sale.id, userId }, 'POS sale created');

      return void res.status(201).json({
        status: 'success',
        message: 'POS sale created successfully',
        data: sale,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating POS sale');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create POS sale',
      });
    }
  }
);

/**
 * GET /api/v1/pos/sales
 * List POS sales
 */
router.get(
  '/sales',
  authorize({ resource: 'pos', action: 'view' }),
  validate({ query: posSaleQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await posService.listPOSSales(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        fromDate: req.query.fromDate as Date | undefined,
        toDate: req.query.toDate as Date | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        sellerId: req.query.sellerId as string | undefined,
        customerId: req.query.customerId as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing POS sales');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list POS sales',
      });
    }
  }
);

/**
 * GET /api/v1/pos/sales/:id
 * Get POS sale by ID
 */
router.get(
  '/sales/:id',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const sale = await posService.getPOSSaleById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: sale,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting POS sale');
      const status =
        error instanceof Error && error.message === 'Invoice is not a sales invoice'
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get POS sale',
      });
    }
  }
);

/**
 * POST /api/v1/pos/sales/:id/cancel
 * Cancel POS sale
 */
router.post(
  '/sales/:id/cancel',
  authorize({ resource: 'pos', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const reason = req.body.reason as string | undefined;
      const returnInvoice = await posService.cancelPOSSale(
        companyId,
        req.params.id,
        reason
      );

      return void res.json({
        status: 'success',
        message: 'POS sale cancelled successfully',
        data: returnInvoice,
      });
    } catch (error) {
      logger.error({ error, saleId: req.params.id }, 'Error cancelling POS sale');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to cancel POS sale',
      });
    }
  }
);

/**
 * GET /api/v1/pos/daily-report
 * Get daily POS report
 */
router.get(
  '/daily-report',
  authorize({ resource: 'pos', action: 'view' }),
  validate({ query: dailyPOSReportQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const report = await posService.getDailyPOSReport({
        companyId,
        date: req.query.date as Date,
        warehouseId: req.query.warehouseId as string | undefined,
        sellerId: req.query.sellerId as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: report.sales,
        summary: report.summary,
        date: report.date,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting daily POS report');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get daily POS report',
      });
    }
  }
);

/**
 * POST /api/v1/pos/sales/:id/print-receipt
 * Print receipt for POS sale
 */
router.post(
  '/sales/:id/print-receipt',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await enqueueAcceptedJob(
        res,
        ASYNC_QUEUE_NAMES.PDF_GENERATION,
        'receipt-pdf',
        {
          companyId,
          userId: req.user?.sub ?? 'system',
          kind: 'receipt',
          invoiceId: req.params.id,
        },
        'Receipt PDF queued'
      );
    } catch (error) {
      logger.error({ error }, 'Error printing receipt');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to print receipt',
      });
    }
  }
);

/**
 * POST /api/v1/pos/inventory/update-real-time
 * Update inventory in real-time for POS operations
 */
router.post(
  '/inventory/update-real-time',
  authorize({ resource: 'pos', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { warehouseId, itemId, quantityChange } = req.body;

      if (!warehouseId || !itemId || quantityChange === undefined) {
        return void res.status(400).json({
          status: 'error',
          message: 'warehouseId, itemId, and quantityChange are required',
        });
      }

      const result = await posService.updateInventoryRealTime(
        companyId,
        warehouseId,
        itemId,
        quantityChange
      );

      return void res.json({
        status: 'success',
        message: 'Inventory updated successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating inventory in real-time');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update inventory',
      });
    }
  }
);

export default router;

