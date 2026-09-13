import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDelegateSchema,
  updateDelegateSchema,
  delegateQuerySchema,
} from '../schemas/delegate.schema';
import { delegateService } from '../services/delegate.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/accounting/delegates
 * List delegates with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'delegate', action: 'view' }),
  validate({ query: delegateQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await delegateService.listDelegates(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        role: req.query.role as 'DELEGATE' | 'DISTRIBUTOR' | 'DRIVER' | undefined,
      });

      logger.info(
        { companyId, count: result.delegates.length },
        'Delegates listed'
      );

      return void res.json({
        status: 'success',
        data: result.delegates,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing delegates');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list delegates',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/delegates/:id
 * Get delegate by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'delegate', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const delegate = await delegateService.getDelegateById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: delegate,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting delegate');
      const status =
        error instanceof Error && error.message === 'Delegate not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get delegate',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/delegates
 * Create delegate
 */
router.post(
  '/',
  authorize({ resource: 'delegate', action: 'edit' }),
  validate({ body: createDelegateSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const delegate = await delegateService.createDelegate(
        companyId,
        req.body
      );

      logger.info({ companyId, delegateId: delegate.id }, 'Delegate created');

      return void res.status(201).json({
        status: 'success',
        message: 'Delegate created successfully',
        data: delegate,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating delegate');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create delegate',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/delegates/:id
 * Update delegate
 */
router.put(
  '/:id',
  authorize({ resource: 'delegate', action: 'edit' }),
  validate({ body: updateDelegateSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const delegate = await delegateService.updateDelegate(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Delegate updated successfully',
        data: delegate,
      });
    } catch (error) {
      logger.error({ error, delegateId: req.params.id }, 'Error updating delegate');
      const status =
        error instanceof Error && error.message === 'Delegate not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update delegate',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/delegates/:id
 * Delete delegate (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'delegate', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await delegateService.deleteDelegate(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, delegateId: req.params.id }, 'Error deleting delegate');
      const status =
        error instanceof Error && error.message === 'Delegate not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete delegate',
      });
    }
  }
);

export default router;
