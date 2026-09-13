import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createAdjustmentSchema,
  adjustmentQuerySchema,
} from '../schemas/adjustment.schema';
import { adjustmentService } from '../services/adjustment.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/adjustments
 * Create adjustment entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createAdjustmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const adjustment = await adjustmentService.createAdjustment(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        warehouseId: req.body.warehouseId,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, adjustmentId: adjustment.id },
        'Adjustment created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Adjustment created successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating adjustment');
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
            : 'Failed to create adjustment',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/adjustments
 * List adjustment entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: adjustmentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await adjustmentService.listAdjustments(companyId, {
        branchId: req.query.branchId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        skip: req.query.skip as number | undefined,
        take: req.query.take as number | undefined,
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
      logger.error({ error }, 'Error listing adjustments');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list adjustments',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/adjustments/:id
 * Get adjustment by ID
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

      const adjustment = await adjustmentService.getAdjustmentById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting adjustment');
      const status =
        error instanceof Error && error.message === 'Adjustment not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/adjustments/:id/post
 * Post adjustment (apply quantity adjustments)
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

      await adjustmentService.postAdjustment(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, adjustmentId: req.params.id }, 'Adjustment posted');

      return void res.json({
        status: 'success',
        message: 'Adjustment posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Adjustment not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/adjustments/:id/unpost
 * Unpost adjustment (reverse quantity adjustments)
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

      await adjustmentService.unpostAdjustment(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, adjustmentId: req.params.id }, 'Adjustment unposted');

      return void res.json({
        status: 'success',
        message: 'Adjustment unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Adjustment not found' ||
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
            : 'Failed to unpost adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/adjustments/:id/cancel
 * Cancel adjustment
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

      const adjustment = await adjustmentService.cancelAdjustment(
        companyId,
        req.params.id
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Adjustment cancelled');

      return void res.json({
        status: 'success',
        message: 'Adjustment cancelled successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Adjustment not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/adjustments/:id/restore
 * Restore cancelled adjustment
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

      const adjustment = await adjustmentService.restoreAdjustment(
        companyId,
        req.params.id
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Adjustment restored');

      return void res.json({
        status: 'success',
        message: 'Adjustment restored successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Adjustment not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore adjustment',
      });
    }
  }
);

export default router;

