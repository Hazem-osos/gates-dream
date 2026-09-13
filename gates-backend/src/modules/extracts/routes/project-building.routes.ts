import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createProjectBuildingSchema,
  updateProjectBuildingSchema,
  projectBuildingQuerySchema,
} from '../schemas/project-building.schema';
import { projectBuildingService } from '../services/project-building.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'project-building', action: 'view' }),
  validate({ query: projectBuildingQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await projectBuildingService.listBuildings(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.buildings,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing project buildings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list project buildings',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'project-building', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const building = await projectBuildingService.getBuildingById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: building,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting project building');
      const status =
        error instanceof Error && error.message === 'Project building not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get project building',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'project-building', action: 'edit' }),
  validate({ body: createProjectBuildingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const building = await projectBuildingService.createBuilding(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Project building created successfully',
        data: building,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating project building');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project building',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'project-building', action: 'edit' }),
  validate({ body: updateProjectBuildingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const building = await projectBuildingService.updateBuilding(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Project building updated successfully',
        data: building,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating project building');
      const status =
        error instanceof Error && error.message === 'Project building not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update project building',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'project-building', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await projectBuildingService.deleteBuilding(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting project building');
      const status =
        error instanceof Error && error.message === 'Project building not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete project building',
      });
    }
  }
);

export default router;

