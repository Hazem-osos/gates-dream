import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createMaritalStatusSchema,
  updateMaritalStatusSchema,
  maritalStatusQuerySchema,
} from '../schemas/marital-status.schema';
import { maritalStatusService } from '../services/marital-status.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'marital-status', action: 'view' }),
  validate({ query: maritalStatusQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await maritalStatusService.listMaritalStatuses(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.maritalStatuses.length },
        'Marital statuses listed'
      );

      return void res.json({
        status: 'success',
        data: result.maritalStatuses,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing marital statuses');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list marital statuses',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'marital-status', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const maritalStatus = await maritalStatusService.getMaritalStatusById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: maritalStatus,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting marital status');
      const status =
        error instanceof Error && error.message === 'Marital status not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get marital status',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'marital-status', action: 'edit' }),
  validate({ body: createMaritalStatusSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const maritalStatus = await maritalStatusService.createMaritalStatus(
        companyId,
        req.body
      );

      logger.info(
        { companyId, maritalStatusId: maritalStatus.id },
        'Marital status created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Marital status created successfully',
        data: maritalStatus,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating marital status');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create marital status',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'marital-status', action: 'edit' }),
  validate({ body: updateMaritalStatusSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const maritalStatus = await maritalStatusService.updateMaritalStatus(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Marital status updated successfully',
        data: maritalStatus,
      });
    } catch (error) {
      logger.error(
        { error, maritalStatusId: req.params.id },
        'Error updating marital status'
      );
      const status =
        error instanceof Error && error.message === 'Marital status not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update marital status',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'marital-status', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await maritalStatusService.deleteMaritalStatus(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, maritalStatusId: req.params.id },
        'Error deleting marital status'
      );
      const status =
        error instanceof Error && error.message === 'Marital status not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete marital status',
      });
    }
  }
);

export default router;
