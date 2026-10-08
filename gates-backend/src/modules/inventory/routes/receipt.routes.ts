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
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';
import { stockPostJson } from '../utils/stock-post-route-response';
import { resolveStockListPaging } from '../utils/stock-list-query';
import { stockMutationMessage, stockMutationStatus } from '../utils/stock-route-error';

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
          message: 'معرّف الشركة مطلوب',
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
        supplierId: req.body.supplierId || undefined,
        offsetAccountId: req.body.offsetAccountId ?? undefined,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, receiptId: receipt.id },
        'Receipt created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ إذن الإضافة',
        data: receipt,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating receipt');
      return void res.status(stockMutationStatus(error)).json({
        status: 'error',
        message: stockMutationMessage(error, 'تعذّر حفظ إذن الإضافة'),
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
          message: 'معرّف الشركة مطلوب',
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
          message: 'معرّف الشركة مطلوب',
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

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createReceiptSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const receipt = await receiptService.updateReceipt(companyId, req.params.id, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        record: req.body.record,
        warehouseId: req.body.warehouseId,
        supplierId: req.body.supplierId || undefined,
        offsetAccountId: req.body.offsetAccountId ?? undefined,
        lines: req.body.lines,
      });
      return void res.json({ status: 'success', message: 'تم حفظ السند', data: receipt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تعديل السند';
      const status = message.includes('not found') || message.includes('غير') ? 400 : message.includes('لا يمكن') ? 400 : 500;
      return void res.status(status).json({ status: 'error', message });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      await receiptService.deleteReceipt(companyId, req.params.id);
      return void res.json({ status: 'success', message: 'تم حذف السند' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر حذف السند';
      const status = message.includes('not found') || message.includes('لا يمكن') ? 400 : 500;
      return void res.status(status).json({ status: 'error', message });
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
          message: 'معرّف الشركة مطلوب',
        });
      }

      const result = await receiptService.postReceipt(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, receiptId: req.params.id }, 'Receipt posted');

      return void res.json(stockPostJson(result, 'تم ترحيل الإضافة بنجاح'));
    } catch (error) {
      logger.error(
        {
          errMessage: error instanceof Error ? error.message : String(error),
          errName: error instanceof Error ? error.name : typeof error,
          prismaCode:
            error && typeof error === 'object' && 'code' in error
              ? String((error as { code: unknown }).code)
              : undefined,
        },
        'Error posting receipt'
      );
      return void res.status(stockMutationStatus(error)).json({
        status: 'error',
        message: stockMutationMessage(error, 'تعذّر ترحيل إذن الإضافة'),
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
          message: 'معرّف الشركة مطلوب',
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
          message: 'معرّف الشركة مطلوب',
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
          message: 'معرّف الشركة مطلوب',
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

