import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { validate } from '../../../shared/middleware/validate';
import { permissionDefinitionsQuerySchema } from '../schemas/permission-definitions.schema';
import { permissionDefinitionsService } from '../services/permission-definitions.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildPayloadEtag, sendJsonWithEtag } from '../../../shared/http/master-data-etag';

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/permissions
 * Get all permission definitions
 */
router.get(
  '/',
  authorize({ resource: 'user_permission', action: 'view' }),
  validate({ query: permissionDefinitionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { module, resource } = req.query;

      let definitions;
      if (module) {
        definitions = permissionDefinitionsService.getPermissionDefinitionsByModule(
          module as string
        );
      } else {
        definitions = permissionDefinitionsService.getPermissionDefinitions();
      }

      // Filter by resource if provided
      if (resource) {
        definitions = definitions.filter((def) => def.resource === resource);
      }

      logger.info({ count: definitions.length, module, resource }, 'Permission definitions listed');

      const body = {
        status: 'success' as const,
        data: definitions,
        count: definitions.length,
      };
      return void sendJsonWithEtag(req, res, buildPayloadEtag(body), body);
    } catch (error) {
      logger.error({ error }, 'Error getting permission definitions');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get permission definitions',
      });
    }
  }
);

/**
 * GET /api/v1/permissions/modules
 * Get available modules
 */
router.get(
  '/modules',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const modules = permissionDefinitionsService.getModules();
      const body = { status: 'success' as const, data: modules, count: modules.length };
      return void sendJsonWithEtag(req, res, buildPayloadEtag(body), body);
    } catch (error) {
      logger.error({ error }, 'Error getting modules');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get modules',
      });
    }
  }
);

/**
 * GET /api/v1/permissions/resources
 * Get available resources
 */
router.get(
  '/resources',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const module = req.query.module as string | undefined;
      const resources = permissionDefinitionsService.getResources(module);
      const body = { status: 'success' as const, data: resources, count: resources.length };
      return void sendJsonWithEtag(req, res, buildPayloadEtag(body), body);
    } catch (error) {
      logger.error({ error }, 'Error getting resources');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get resources',
      });
    }
  }
);

/**
 * GET /api/v1/permissions/:resource/actions
 * Get available actions for a resource
 */
router.get(
  '/:resource/actions',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const actions = permissionDefinitionsService.getResourceActions(
        req.params.resource
      );

      const body = {
        status: 'success' as const,
        data: {
          resource: req.params.resource,
          actions,
        },
      };
      return void sendJsonWithEtag(req, res, buildPayloadEtag(body), body);
    } catch (error) {
      logger.error({ error }, 'Error getting resource actions');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get resource actions',
      });
    }
  }
);

export default router;

