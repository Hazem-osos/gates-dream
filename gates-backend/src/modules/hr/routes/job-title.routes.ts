import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createJobTitleSchema,
  updateJobTitleSchema,
  jobTitleQuerySchema,
} from '../schemas/job-title.schema';
import { jobTitleService } from '../services/job-title.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'job-title', action: 'view' }),
  validate({ query: jobTitleQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await jobTitleService.listJobTitles(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.jobTitles.length }, 'Job titles listed');

      return void res.json({
        status: 'success',
        data: result.jobTitles,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing job titles');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list job titles',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'job-title', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobTitle = await jobTitleService.getJobTitleById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: jobTitle,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting job title');
      const status =
        error instanceof Error && error.message === 'Job title not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get job title',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'job-title', action: 'edit' }),
  validate({ body: createJobTitleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobTitle = await jobTitleService.createJobTitle(companyId, req.body);

      logger.info({ companyId, jobTitleId: jobTitle.id }, 'Job title created');

      return void res.status(201).json({
        status: 'success',
        message: 'Job title created successfully',
        data: jobTitle,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating job title');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create job title',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'job-title', action: 'edit' }),
  validate({ body: updateJobTitleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const jobTitle = await jobTitleService.updateJobTitle(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Job title updated successfully',
        data: jobTitle,
      });
    } catch (error) {
      logger.error({ error, jobTitleId: req.params.id }, 'Error updating job title');
      const status =
        error instanceof Error && error.message === 'Job title not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update job title',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'job-title', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await jobTitleService.deleteJobTitle(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, jobTitleId: req.params.id }, 'Error deleting job title');
      const status =
        error instanceof Error && error.message === 'Job title not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete job title',
      });
    }
  }
);

export default router;
