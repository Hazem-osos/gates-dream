import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createAssemblySchema,
  assemblyQuerySchema,
} from '../schemas/assembly.schema';
import { assemblyService } from '../services/assembly.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildStockGlPostingContext } from '../services/stock-gl-posting-context';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/assemblies
 * Create assembly entry
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createAssemblySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const assembly = await assemblyService.createAssembly(companyId, {
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
        { companyId, assemblyId: assembly.id },
        'Assembly created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Assembly created successfully',
        data: assembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating assembly');
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
            : 'Failed to create assembly',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/assemblies
 * List assembly entries
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: assemblyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await assemblyService.listAssemblies(companyId, {
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
      logger.error({ error }, 'Error listing assemblies');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list assemblies',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/assemblies/:id
 * Replace a draft assembly
 */
router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createAssemblySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const assembly = await assemblyService.updateAssembly(companyId, req.params.id, {
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
        message: 'Assembly updated successfully',
        data: assembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating assembly');
      const status =
        error instanceof Error &&
        (error.message === 'Assembly not found' ||
          error.message.includes('Cannot') ||
          error.message.includes('not found'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update assembly',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/assemblies/:id
 * Get assembly by ID
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

      const assembly = await assemblyService.getAssemblyById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: assembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting assembly');
      const status =
        error instanceof Error && error.message === 'Assembly not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get assembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/assemblies/:id/post
 * Post assembly (consume components and create assembled items)
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

      await assemblyService.postAssembly(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, assemblyId: req.params.id }, 'Assembly posted');

      return void res.json({
        status: 'success',
        message: 'Assembly posted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error posting assembly');
      const status =
        error instanceof Error &&
        (error.message === 'Assembly not found' ||
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
            : 'Failed to post assembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/assemblies/:id/unpost
 * Unpost assembly (reverse quantity changes)
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

      await assemblyService.unpostAssembly(companyId, req.params.id, buildStockGlPostingContext(req, companyId));

      logger.info({ companyId, assemblyId: req.params.id }, 'Assembly unposted');

      return void res.json({
        status: 'success',
        message: 'Assembly unposted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting assembly');
      const status =
        error instanceof Error &&
        (error.message === 'Assembly not found' ||
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
            : 'Failed to unpost assembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/assemblies/:id/cancel
 * Cancel assembly
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

      const assembly = await assemblyService.cancelAssembly(
        companyId,
        req.params.id
      );

      logger.info({ companyId, assemblyId: req.params.id }, 'Assembly cancelled');

      return void res.json({
        status: 'success',
        message: 'Assembly cancelled successfully',
        data: assembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling assembly');
      const status =
        error instanceof Error &&
        (error.message === 'Assembly not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel assembly',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/assemblies/:id/restore
 * Restore cancelled assembly
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

      const assembly = await assemblyService.restoreAssembly(
        companyId,
        req.params.id
      );

      logger.info({ companyId, assemblyId: req.params.id }, 'Assembly restored');

      return void res.json({
        status: 'success',
        message: 'Assembly restored successfully',
        data: assembly,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring assembly');
      const status =
        error instanceof Error &&
        (error.message === 'Assembly not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore assembly',
      });
    }
  }
);

export default router;

