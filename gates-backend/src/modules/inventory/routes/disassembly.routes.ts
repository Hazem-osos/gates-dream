import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDisassemblySchema,
  disassemblyQuerySchema,
} from '../schemas/disassembly.schema';
import { disassemblyService } from '../services/disassembly.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/disassemblies
 * Create disassembly entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createDisassemblySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const disassembly = await disassemblyService.createDisassembly(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        warehouseId: req.body.warehouseId,
        toWarehouseId: req.body.toWarehouseId,
        costCenterId: req.body.costCenterId,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, disassemblyId: disassembly.id },
        'Disassembly created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Disassembly created successfully',
        data: disassembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating disassembly');
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
            : 'Failed to create disassembly',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/disassemblies
 * List disassembly entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: disassemblyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await disassemblyService.listDisassemblies(companyId, {
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
      logger.error({ error }, 'Error listing disassemblies');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list disassemblies',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/disassemblies/:id
 * Replace a draft disassembly
 */
router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createDisassemblySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const disassembly = await disassemblyService.updateDisassembly(companyId, req.params.id, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        date: req.body.date,
        hijriDate: req.body.hijriDate,
        warehouseId: req.body.warehouseId,
        toWarehouseId: req.body.toWarehouseId,
        costCenterId: req.body.costCenterId,
        lines: req.body.lines,
      });
      return void res.json({
        status: 'success',
        message: 'Disassembly updated successfully',
        data: disassembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating disassembly');
      const status =
        error instanceof Error &&
        (error.message === 'Disassembly not found' ||
          error.message.includes('Cannot') ||
          error.message.includes('not found'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update disassembly',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/disassemblies/:id
 * Get disassembly by ID
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

      const disassembly = await disassemblyService.getDisassemblyById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: disassembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting disassembly');
      const status =
        error instanceof Error && error.message === 'Disassembly not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get disassembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/disassemblies/:id/post
 * Post disassembly (consume disassembled items and create component items)
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

      await disassemblyService.postDisassembly(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, disassemblyId: req.params.id }, 'Disassembly posted');

      return void res.json({
        status: 'success',
        message: 'Disassembly posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting disassembly');
      const status =
        error instanceof Error &&
        (error.message === 'Disassembly not found' ||
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
            : 'Failed to post disassembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/disassemblies/:id/unpost
 * Unpost disassembly (reverse quantity changes)
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

      await disassemblyService.unpostDisassembly(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, disassemblyId: req.params.id }, 'Disassembly unposted');

      return void res.json({
        status: 'success',
        message: 'Disassembly unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting disassembly');
      const status =
        error instanceof Error &&
        (error.message === 'Disassembly not found' ||
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
            : 'Failed to unpost disassembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/disassemblies/:id/cancel
 * Cancel disassembly
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

      const disassembly = await disassemblyService.cancelDisassembly(
        companyId,
        req.params.id
      );

      logger.info({ companyId, disassemblyId: req.params.id }, 'Disassembly cancelled');

      return void res.json({
        status: 'success',
        message: 'Disassembly cancelled successfully',
        data: disassembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling disassembly');
      const status =
        error instanceof Error &&
        (error.message === 'Disassembly not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel disassembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/disassemblies/:id/restore
 * Restore cancelled disassembly
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

      const disassembly = await disassemblyService.restoreDisassembly(
        companyId,
        req.params.id
      );

      logger.info({ companyId, disassemblyId: req.params.id }, 'Disassembly restored');

      return void res.json({
        status: 'success',
        message: 'Disassembly restored successfully',
        data: disassembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring disassembly');
      const status =
        error instanceof Error &&
        (error.message === 'Disassembly not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore disassembly',
      });
    }
  }
);

export default router;

