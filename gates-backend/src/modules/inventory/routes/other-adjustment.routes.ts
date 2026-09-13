import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createOtherAdjustmentSchema,
  otherAdjustmentQuerySchema,
} from '../schemas/other-adjustment.schema';
import { otherAdjustmentService } from '../services/other-adjustment.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/other-adjustments
 * Create other adjustment entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createOtherAdjustmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const adjustment = await otherAdjustmentService.createOtherAdjustment(companyId, {
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
        'Other adjustment created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Other adjustment created successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating other adjustment');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong') ||
          error.message.includes('Insufficient'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create other adjustment',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/other-adjustments
 * List other adjustment entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: otherAdjustmentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await otherAdjustmentService.listOtherAdjustments(companyId, {
        branchId: req.query.branchId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        adjustmentType: req.query.adjustmentType as 'addition' | 'discount' | undefined,
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
      logger.error({ error }, 'Error listing other adjustments');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list other adjustments',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/other-adjustments/:id
 * Get other adjustment by ID
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

      const adjustment = await otherAdjustmentService.getOtherAdjustmentById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting other adjustment');
      const status =
        error instanceof Error && error.message === 'Other adjustment not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get other adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/other-adjustments/:id/post
 * Post other adjustment (apply quantity changes)
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

      await otherAdjustmentService.postOtherAdjustment(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Other adjustment posted');

      return void res.json({
        status: 'success',
        message: 'Other adjustment posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting other adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Other adjustment not found' ||
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
            : 'Failed to post other adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/other-adjustments/:id/unpost
 * Unpost other adjustment (reverse quantity changes)
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

      await otherAdjustmentService.unpostOtherAdjustment(
        companyId,
        req.params.id,
        buildStockGlPostingContext(req, companyId)
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Other adjustment unposted');

      return void res.json({
        status: 'success',
        message: 'Other adjustment unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting other adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Other adjustment not found' ||
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
            : 'Failed to unpost other adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/other-adjustments/:id/cancel
 * Cancel other adjustment
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

      const adjustment = await otherAdjustmentService.cancelOtherAdjustment(
        companyId,
        req.params.id
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Other adjustment cancelled');

      return void res.json({
        status: 'success',
        message: 'Other adjustment cancelled successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling other adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Other adjustment not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel other adjustment',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/other-adjustments/:id/restore
 * Restore cancelled other adjustment
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

      const adjustment = await otherAdjustmentService.restoreOtherAdjustment(
        companyId,
        req.params.id
      );

      logger.info({ companyId, adjustmentId: req.params.id }, 'Other adjustment restored');

      return void res.json({
        status: 'success',
        message: 'Other adjustment restored successfully',
        data: adjustment,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring other adjustment');
      const status =
        error instanceof Error &&
        (error.message === 'Other adjustment not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore other adjustment',
      });
    }
  }
);

export default router;

