import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createJobCadreSchema,
  updateJobCadreSchema,
  jobCadreQuerySchema,
} from '../schemas/job-cadre.schema';
import { jobCadreService } from '../services/job-cadre.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'job-cadre', action: 'view' }),
  validate({ query: jobCadreQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await jobCadreService.listJobCadres(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.jobCadres.length }, 'Job cadres listed');

      return void res.json({
        status: 'success',
        data: result.jobCadres,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing job cadres');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list job cadres',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'job-cadre', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobCadre = await jobCadreService.getJobCadreById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: jobCadre,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting job cadre');
      const status =
        error instanceof Error && error.message === 'Job cadre not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get job cadre',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'job-cadre', action: 'edit' }),
  validate({ body: createJobCadreSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobCadre = await jobCadreService.createJobCadre(companyId, req.body);

      logger.info({ companyId, jobCadreId: jobCadre.id }, 'Job cadre created');

      return void res.status(201).json({
        status: 'success',
        message: 'Job cadre created successfully',
        data: jobCadre,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating job cadre');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create job cadre',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'job-cadre', action: 'edit' }),
  validate({ body: updateJobCadreSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobCadre = await jobCadreService.updateJobCadre(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Job cadre updated successfully',
        data: jobCadre,
      });
    } catch (error) {
      logger.error({ error, jobCadreId: req.params.id }, 'Error updating job cadre');
      const status =
        error instanceof Error && error.message === 'Job cadre not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update job cadre',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'job-cadre', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await jobCadreService.deleteJobCadre(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, jobCadreId: req.params.id }, 'Error deleting job cadre');
      const status =
        error instanceof Error && error.message === 'Job cadre not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete job cadre',
      });
    }
  }
);

export default router;
