import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPeriodSchema,
  updatePeriodSchema,
  periodQuerySchema,
} from '../schemas/period.schema';
import { periodService } from '../services/period.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/accounting/periods
 * List periods with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'period', action: 'view' }),
  validate({ query: periodQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await periodService.listPeriods(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        isClosed: req.query.isClosed as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.periods.length },
        'Periods listed'
      );

      return void res.json({
        status: 'success',
        data: result.periods,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing periods');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list periods',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/periods/current
 * Get current active period
 */
router.get(
  '/current',
  authorize({ resource: 'period', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const period = await periodService.getCurrentPeriod(companyId);

      return void res.json({
        status: 'success',
        data: period,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting current period');
      const status =
        error instanceof Error && error.message === 'No active period found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get current period',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/periods/:id
 * Get period by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'period', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const period = await periodService.getPeriodById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: period,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting period');
      const status =
        error instanceof Error && error.message === 'Period not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get period',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/periods
 * Create period
 */
router.post(
  '/',
  authorize({ resource: 'period', action: 'edit' }),
  validate({ body: createPeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date strings to Date objects
      const data = {
        ...req.body,
        startDate:
          typeof req.body.startDate === 'string'
            ? new Date(req.body.startDate)
            : req.body.startDate,
        endDate:
          typeof req.body.endDate === 'string'
            ? new Date(req.body.endDate)
            : req.body.endDate,
      };

      const period = await periodService.createPeriod(companyId, data);

      logger.info({ companyId, periodId: period.id }, 'Period created');

      return void res.status(201).json({
        status: 'success',
        message: 'Period created successfully',
        data: period,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating period');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create period',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/periods/:id
 * Update period
 */
router.put(
  '/:id',
  authorize({ resource: 'period', action: 'edit' }),
  validate({ body: updatePeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date strings to Date objects if provided
      const data: any = { ...req.body };
      if (req.body.startDate) {
        data.startDate =
          typeof req.body.startDate === 'string'
            ? new Date(req.body.startDate)
            : req.body.startDate;
      }
      if (req.body.endDate) {
        data.endDate =
          typeof req.body.endDate === 'string'
            ? new Date(req.body.endDate)
            : req.body.endDate;
      }

      const period = await periodService.updatePeriod(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Period updated successfully',
        data: period,
      });
    } catch (error) {
      logger.error({ error, periodId: req.params.id }, 'Error updating period');
      const status =
        error instanceof Error &&
        (error.message === 'Period not found' ||
          error.message === 'Start date must be before end date')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update period',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/periods/:id/close
 * Close period
 */
router.post(
  '/:id/close',
  authorize({ resource: 'period', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const period = await periodService.closePeriod(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Period closed successfully',
        data: period,
      });
    } catch (error) {
      logger.error({ error, periodId: req.params.id }, 'Error closing period');
      const status =
        error instanceof Error &&
        (error.message === 'Period not found' ||
          error.message === 'Period is already closed')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to close period',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/periods/:id
 * Delete period (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'period', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await periodService.deletePeriod(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, periodId: req.params.id }, 'Error deleting period');
      const status =
        error instanceof Error && error.message === 'Period not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete period',
      });
    }
  }
);

export default router;
