import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createProjectWorkItemSchema,
  updateProjectWorkItemSchema,
  projectWorkItemQuerySchema,
} from '../schemas/project-work-item.schema';
import { projectWorkItemService } from '../services/project-work-item.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'project-work-item', action: 'view' }),
  validate({ query: projectWorkItemQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await projectWorkItemService.listWorkItems(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        buildingId: req.query.buildingId as string | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.workItems,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing project work items');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list project work items',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'project-work-item', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const workItem = await projectWorkItemService.getWorkItemById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: workItem,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting project work item');
      const status =
        error instanceof Error && error.message === 'Project work item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get project work item',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'project-work-item', action: 'edit' }),
  validate({ body: createProjectWorkItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const workItem = await projectWorkItemService.createWorkItem(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Project work item created successfully',
        data: workItem,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating project work item');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project work item',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'project-work-item', action: 'edit' }),
  validate({ body: updateProjectWorkItemSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const workItem = await projectWorkItemService.updateWorkItem(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Project work item updated successfully',
        data: workItem,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating project work item');
      const status =
        error instanceof Error && error.message === 'Project work item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update project work item',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'project-work-item', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await projectWorkItemService.deleteWorkItem(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting project work item');
      const status =
        error instanceof Error && error.message === 'Project work item not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete project work item',
      });
    }
  }
);

export default router;

