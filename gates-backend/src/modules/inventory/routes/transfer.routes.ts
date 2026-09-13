import { Router, Response } from 'express';
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

      const transfer = await transferService.createTransfer(companyId, {
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

      logger.info(
        { companyId, transferId: transfer.id },
        'Transfer created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Transfer created successfully',
        data: transfer,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating transfer');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong') ||
          error.message.includes('cannot be the same') ||
          error.message.includes('Insufficient'))
          ? 400
          : 500;
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
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await transferService.listTransfers(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromWarehouseId: req.query.fromWarehouseId as string | undefined,
        toWarehouseId: req.query.toWarehouseId as string | undefined,
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
      logger.error({ error }, 'Error listing transfers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list transfers',
      });
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

