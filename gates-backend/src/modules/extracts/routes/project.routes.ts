import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
} from '../schemas/project.schema';
import { projectService } from '../services/project.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/extracts/projects
 * List projects
 */
router.get(
  '/',
  authorize({ resource: 'project', action: 'view' }),
  validate({ query: projectQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await projectService.listProjects(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.projects,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing projects');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list projects',
      });
    }
  }
);

/**
 * GET /api/v1/extracts/projects/:id
 * Get project by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'project', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const project = await projectService.getProjectById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: project,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting project');
      const status =
        error instanceof Error && error.message === 'Project not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get project',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/projects
 * Create project
 */
router.post(
  '/',
  authorize({ resource: 'project', action: 'edit' }),
  validate({ body: createProjectSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const project = await projectService.createProject(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Project created successfully',
        data: project,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating project');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create project',
      });
    }
  }
);

/**
 * PUT /api/v1/extracts/projects/:id
 * Update project
 */
router.put(
  '/:id',
  authorize({ resource: 'project', action: 'edit' }),
  validate({ body: updateProjectSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const project = await projectService.updateProject(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Project updated successfully',
        data: project,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating project');
      const status =
        error instanceof Error && error.message === 'Project not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update project',
      });
    }
  }
);

/**
 * DELETE /api/v1/extracts/projects/:id
 * Delete project
 */
router.delete(
  '/:id',
  authorize({ resource: 'project', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await projectService.deleteProject(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting project');
      const status =
        error instanceof Error && error.message === 'Project not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete project',
      });
    }
  }
);

export default router;

