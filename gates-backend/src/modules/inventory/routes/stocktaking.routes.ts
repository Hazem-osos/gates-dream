import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createStocktakingSchema,
  stocktakingQuerySchema,
} from '../schemas/stocktaking.schema';
import { stocktakingService } from '../services/stocktaking.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/stocktaking
 * Create stocktaking entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createStocktakingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const stocktaking = await stocktakingService.createStocktaking(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        warehouseId: req.body.warehouseId,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, stocktakingId: stocktaking.id },
        'Stocktaking created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Stocktaking created successfully',
        data: stocktaking,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating stocktaking');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create stocktaking',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/stocktaking
 * List stocktaking entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: stocktakingQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await stocktakingService.listStocktaking(companyId, {
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
      logger.error({ error }, 'Error listing stocktaking');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list stocktaking',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/stocktaking/:id
 * Get stocktaking by ID
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

      const stocktaking = await stocktakingService.getStocktakingById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: stocktaking,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting stocktaking');
      const status =
        error instanceof Error && error.message === 'Stocktaking not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get stocktaking',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/stocktaking/:id/post
 * Post stocktaking (adjust item quantities)
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

      await stocktakingService.postStocktaking(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, stocktakingId: req.params.id }, 'Stocktaking posted');

      return void res.json({
        status: 'success',
        message: 'Stocktaking posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting stocktaking');
      const status =
        error instanceof Error &&
        (error.message === 'Stocktaking not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post stocktaking',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/stocktaking/:id/unpost
 * Unpost stocktaking (reverse quantity adjustments)
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

      await stocktakingService.unpostStocktaking(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, stocktakingId: req.params.id }, 'Stocktaking unposted');

      return void res.json({
        status: 'success',
        message: 'Stocktaking unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting stocktaking');
      const status =
        error instanceof Error &&
        (error.message === 'Stocktaking not found' ||
          error.message.includes('not posted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost stocktaking',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/stocktaking/:id/cancel
 * Cancel stocktaking
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

      const stocktaking = await stocktakingService.cancelStocktaking(
        companyId,
        req.params.id
      );

      logger.info({ companyId, stocktakingId: req.params.id }, 'Stocktaking cancelled');

      return void res.json({
        status: 'success',
        message: 'Stocktaking cancelled successfully',
        data: stocktaking,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling stocktaking');
      const status =
        error instanceof Error &&
        (error.message === 'Stocktaking not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel stocktaking',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/stocktaking/:id/restore
 * Restore cancelled stocktaking
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

      const stocktaking = await stocktakingService.restoreStocktaking(
        companyId,
        req.params.id
      );

      logger.info({ companyId, stocktakingId: req.params.id }, 'Stocktaking restored');

      return void res.json({
        status: 'success',
        message: 'Stocktaking restored successfully',
        data: stocktaking,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring stocktaking');
      const status =
        error instanceof Error &&
        (error.message === 'Stocktaking not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore stocktaking',
      });
    }
  }
);

export default router;

