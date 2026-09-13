import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { validate } from '../../../shared/middleware/validate';
import { roleDefinitionsQuerySchema } from '../schemas/role-definitions.schema';
import { roleDefinitionsService } from '../services/role-definitions.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/roles
 * Get all role definitions
 */
router.get(
  '/',
  authorize({ resource: 'user_permission', action: 'view' }),
  validate({ query: roleDefinitionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { module } = req.query;

      let definitions;
      if (module) {
        definitions = roleDefinitionsService.getRoleDefinitionsByModule(
          module as string
        );
      } else {
        definitions = roleDefinitionsService.getRoleDefinitions();
      }

      logger.info({ count: definitions.length, module }, 'Role definitions listed');

      return void res.json({
        status: 'success',
        data: definitions,
        count: definitions.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting role definitions');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get role definitions',
      });
    }
  }
);

/**
 * GET /api/v1/roles/:roleName
 * Get role definition by name
 */
router.get(
  '/:roleName',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const role = roleDefinitionsService.getRoleDefinition(req.params.roleName);

      if (!role) {
        return void res.status(404).json({
          status: 'error',
          message: 'Role not found',
        });
      }

      return void res.json({
        status: 'success',
        data: role,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting role definition');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get role definition',
      });
    }
  }
);

/**
 * GET /api/v1/roles/:roleName/permissions
 * Get permissions for a role
 */
router.get(
  '/:roleName/permissions',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const permissions = roleDefinitionsService.getRolePermissions(
        req.params.roleName
      );

      if (permissions.length === 0) {
        return void res.status(404).json({
          status: 'error',
          message: 'Role not found',
        });
      }

      return void res.json({
        status: 'success',
        data: {
          role: req.params.roleName,
          permissions,
          count: permissions.length,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting role permissions');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get role permissions',
      });
    }
  }
);

/**
 * GET /api/v1/roles/list
 * Get list of available role names
 */
router.get(
  '/list',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const module = req.query.module as string | undefined;
      const roles = roleDefinitionsService.getAvailableRoles(module);

      return void res.json({
        status: 'success',
        data: roles,
        count: roles.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting available roles');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get available roles',
      });
    }
  }
);

export default router;

