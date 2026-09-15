import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createReceiptSchema,
  receiptQuerySchema,
} from '../schemas/receipt.schema';
import { receiptService } from '../services/receipt.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';
import { resolveStockListPaging } from '../utils/stock-list-query';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/receipts
 * Create receipt entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createReceiptSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await receiptService.createReceipt(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        record: req.body.record,
        warehouseId: req.body.warehouseId,
        lines: req.body.lines,
      });

      if (isAdminRequest(req)) {
        await receiptService.postReceipt(companyId, receipt.id, buildStockGlPostingContext(req, companyId));
      }

      logger.info(
        { companyId, receiptId: receipt.id },
        'Receipt created'
      );

      return void res.status(201).json({
        status: 'success',
        message: isAdminRequest(req) ? 'تم حفظ وترحيل الإضافة تلقائياً' : 'Receipt created successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating receipt');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create receipt',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/receipts
 * List receipt entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: receiptQuerySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const query = req.query as unknown as {
        branchId?: string;
        warehouseId?: string;
        isPosted?: boolean;
        isApproved?: boolean;
        isCancelled?: boolean;
        fromDate?: string;
        toDate?: string;
        search?: string;
        page?: number;
        limit?: number;
        skip?: number;
        take?: number;
      };
      const { skip, take } = resolveStockListPaging(query);

      const result = await receiptService.listReceipts(companyId, {
        branchId: query.branchId,
        warehouseId: query.warehouseId,
        isPosted: query.isPosted,
        isApproved: query.isApproved,
        isCancelled: query.isCancelled,
        fromDate: query.fromDate,
        toDate: query.toDate,
        search: query.search,
        skip,
        take,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: {
          total: result.total,
          skip: result.skip,
          take: result.take,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/inventory/receipts/:id
 * Get receipt by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await receiptService.getReceiptById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting receipt');
      const status =
        error instanceof Error && error.message === 'Receipt not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get receipt',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/receipts/:id/post
 * Post receipt (add quantities to warehouse)
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await receiptService.postReceipt(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, receiptId: req.params.id }, 'Receipt posted');

      return void res.json({
        status: 'success',
        message: 'Receipt posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting receipt');
      const status =
        error instanceof Error &&
        (error.message === 'Receipt not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot') ||
          error.message.includes('Insufficient'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post receipt',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/receipts/:id/unpost
 * Unpost receipt (reverse quantity additions)
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await receiptService.unpostReceipt(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, receiptId: req.params.id }, 'Receipt unposted');

      return void res.json({
        status: 'success',
        message: 'Receipt unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting receipt');
      const status =
        error instanceof Error &&
        (error.message === 'Receipt not found' ||
          error.message.includes('not posted') ||
          error.message.includes('Cannot unpost') ||
          error.message.includes('Insufficient'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost receipt',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/receipts/:id/cancel
 * Cancel receipt
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await receiptService.cancelReceipt(
        companyId,
        req.params.id
      );

      logger.info({ companyId, receiptId: req.params.id }, 'Receipt cancelled');

      return void res.json({
        status: 'success',
        message: 'Receipt cancelled successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling receipt');
      const status =
        error instanceof Error &&
        (error.message === 'Receipt not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel receipt',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/receipts/:id/restore
 * Restore cancelled receipt
 */
router.post(
  '/:id/restore',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const receipt = await receiptService.restoreReceipt(
        companyId,
        req.params.id
      );

      logger.info({ companyId, receiptId: req.params.id }, 'Receipt restored');

      return void res.json({
        status: 'success',
        message: 'Receipt restored successfully',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring receipt');
      const status =
        error instanceof Error &&
        (error.message === 'Receipt not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore receipt',
      });
    }
  }
);

export default router;

