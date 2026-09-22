import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createTransferSchema,
  transferQuerySchema,
} from '../schemas/transfer.schema';
import { transferService } from '../services/transfer.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';
import { resolveStockListPaging } from '../utils/stock-list-query';
import { AppError } from '../../../shared/middleware/error-handler';

function transferErrorStatus(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (!(error instanceof Error)) return 500;
  const message = error.message;
  if (message === 'Transfer not found') return 404;
  if (
    message.includes('cannot be the same') ||
    message.includes('يجب أن يكونا مختلفين') ||
    message.includes('غير موجود') ||
    message.includes('Cannot') ||
    message.includes('not found') ||
    message.includes('do not belong') ||
    message.includes('Insufficient') ||
    message.includes('لا تكفي') ||
    message.includes('بالسالب')
  ) {
    return 400;
  }
  return 500;
}

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/transfers
 * Create transfer entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createTransferSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const created = await transferService.createTransfer(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        fromWarehouseId: req.body.fromWarehouseId,
        toWarehouseId: req.body.toWarehouseId,
        fromCostCenterId: req.body.fromCostCenterId || undefined,
        toCostCenterId: req.body.toCostCenterId || undefined,
        lines: req.body.lines,
      });

      try {
        await transferService.postTransfer(
          companyId,
          created.id,
          buildStockGlPostingContext(req, companyId)
        );
      } catch (error) {
        await transferService.deleteTransfer(companyId, created.id).catch(() => undefined);
        throw error;
      }

      const transfer = await transferService.getTransferById(companyId, created.id);

      logger.info(
        { companyId, transferId: transfer.id },
        'Transfer created and posted'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ وترحيل النقل',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating transfer');
      const status = transferErrorStatus(error);
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create transfer',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/transfers
 * List transfer entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: transferQuerySchema }),
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
        fromWarehouseId?: string;
        toWarehouseId?: string;
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

      const result = await transferService.listTransfers(companyId, {
        branchId: query.branchId,
        fromWarehouseId: query.fromWarehouseId,
        toWarehouseId: query.toWarehouseId,
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
 * GET /api/v1/inventory/transfers/:id
 * Get transfer by ID
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

      const transfer = await transferService.getTransferById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting transfer');
      const status =
        error instanceof Error && error.message === 'Transfer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get transfer',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/transfers/:id
 * Replace a draft transfer
 */
router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createTransferSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const updated = await transferService.updateTransfer(companyId, req.params.id, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        fromWarehouseId: req.body.fromWarehouseId,
        toWarehouseId: req.body.toWarehouseId,
        fromCostCenterId: req.body.fromCostCenterId || undefined,
        toCostCenterId: req.body.toCostCenterId || undefined,
        lines: req.body.lines,
      });

      await transferService.postTransfer(
        companyId,
        updated.id,
        buildStockGlPostingContext(req, companyId)
      );

      const transfer = await transferService.getTransferById(companyId, updated.id);

      return void res.json({
        status: 'success',
        message: 'تم حفظ وترحيل النقل',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating transfer');
      const status = transferErrorStatus(error);
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update transfer',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/transfers/:id
 * Hard-delete an unposted transfer
 */
router.delete(
  '/:id',
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

      await transferService.deleteTransfer(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Transfer deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting transfer');
      const status =
        error instanceof Error &&
        (error.message === 'Transfer not found' || error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete transfer',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/transfers/:id/post
 * Post transfer (move quantities between warehouses)
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

      await transferService.postTransfer(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, transferId: req.params.id }, 'Transfer posted');

      return void res.json({
        status: 'success',
        message: 'Transfer posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting transfer');
      const status =
        error instanceof Error &&
        (error.message === 'Transfer not found' ||
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
            : 'Failed to post transfer',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/transfers/:id/unpost
 * Unpost transfer (reverse quantity movements)
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

      await transferService.unpostTransfer(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, transferId: req.params.id }, 'Transfer unposted');

      return void res.json({
        status: 'success',
        message: 'Transfer unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting transfer');
      const status =
        error instanceof Error &&
        (error.message === 'Transfer not found' ||
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
            : 'Failed to unpost transfer',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/transfers/:id/cancel
 * Cancel transfer
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

      const transfer = await transferService.cancelTransfer(
        companyId,
        req.params.id
      );

      logger.info({ companyId, transferId: req.params.id }, 'Transfer cancelled');

      return void res.json({
        status: 'success',
        message: 'Transfer cancelled successfully',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling transfer');
      const status =
        error instanceof Error &&
        (error.message === 'Transfer not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel transfer',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/transfers/:id/restore
 * Restore cancelled transfer
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

      const transfer = await transferService.restoreTransfer(
        companyId,
        req.params.id
      );

      logger.info({ companyId, transferId: req.params.id }, 'Transfer restored');

      return void res.json({
        status: 'success',
        message: 'Transfer restored successfully',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring transfer');
      const status =
        error instanceof Error &&
        (error.message === 'Transfer not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore transfer',
      });
    }
  }
);

export default router;

