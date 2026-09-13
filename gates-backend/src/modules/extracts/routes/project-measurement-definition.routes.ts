import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createProjectMeasurementDefinitionSchema,
  updateProjectMeasurementDefinitionSchema,
  projectMeasurementDefinitionQuerySchema,
} from '../schemas/project-measurement-definition.schema';
import { projectMeasurementDefinitionService } from '../services/project-measurement-definition.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'project-measurement-definition', action: 'view' }),
  validate({ query: projectMeasurementDefinitionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await projectMeasurementDefinitionService.listDefinitions(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.definitions,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing project measurement definitions');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list project measurement definitions',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'project-measurement-definition', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await projectMeasurementDefinitionService.getDefinitionById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting project measurement definition');
      const status =
        error instanceof Error && error.message === 'Project measurement definition not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get project measurement definition',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'project-measurement-definition', action: 'edit' }),
  validate({ body: createProjectMeasurementDefinitionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await projectMeasurementDefinitionService.createDefinition(
        companyId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Project measurement definition created successfully',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating project measurement definition');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create project measurement definition',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'project-measurement-definition', action: 'edit' }),
  validate({ body: updateProjectMeasurementDefinitionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const definition = await projectMeasurementDefinitionService.updateDefinition(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Project measurement definition updated successfully',
        data: definition,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating project measurement definition');
      const status =
        error instanceof Error && error.message === 'Project measurement definition not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update project measurement definition',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'project-measurement-definition', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await projectMeasurementDefinitionService.deleteDefinition(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting project measurement definition');
      const status =
        error instanceof Error && error.message === 'Project measurement definition not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete project measurement definition',
      });
    }
  }
);

export default router;

