import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  assignPermissionSchema,
  assignPermissionsSchema,
  advancedPermissionSchema,
  documentRightsSchema,
  permissionQuerySchema,
} from '../schemas/user-permissions.schema';
import { userPermissionsService } from '../services/user-permissions.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { LEGACY_ADVANCED_RIGHT_FAMILIES } from '../../platform/data/legacy-advanced-rights-families';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/users/:userId/permissions
 * Assign permission to user
 */
router.post(
  '/:userId/permissions',
  authorize({ resource: 'user_permission', action: 'edit' }),
  validate({ body: assignPermissionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Ensure userId in body matches URL param
      const data = {
        ...req.body,
        userId: req.params.userId,
      };

      const permission = await userPermissionsService.assignPermission(
        companyId,
        data
      );

      logger.info(
        { companyId, userId: req.params.userId, permissionId: permission.id },
        'Permission assigned'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Permission assigned successfully',
        data: permission,
      });
    } catch (error) {
      logger.error({ error }, 'Error assigning permission');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to assign permission',
      });
    }
  }
);

/**
 * POST /api/v1/users/:userId/permissions/bulk
 * Assign multiple permissions to user
 */
router.post(
  '/:userId/permissions/bulk',
  authorize({ resource: 'user_permission', action: 'edit' }),
  validate({ body: assignPermissionsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Ensure userId in body matches URL param
      const data = {
        ...req.body,
        userId: req.params.userId,
      };

      const result = await userPermissionsService.assignPermissions(
        companyId,
        data
      );

      logger.info(
        { companyId, userId: req.params.userId, count: result.count },
        'Permissions assigned'
      );

      return void res.json({
        status: 'success',
        message: 'Permissions assigned successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error assigning permissions');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to assign permissions',
      });
    }
  }
);

/**
 * DELETE /api/v1/users/:userId/permissions/:permissionId
 * Remove permission from user
 */
router.delete(
  '/:userId/permissions/:permissionId',
  authorize({ resource: 'user_permission', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await userPermissionsService.removePermission(
        companyId,
        req.params.userId,
        req.params.permissionId
      );

      logger.info(
        { companyId, userId: req.params.userId, permissionId: req.params.permissionId },
        'Permission removed'
      );

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error removing permission');
      const status =
        error instanceof Error && error.message === 'Permission not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to remove permission',
      });
    }
  }
);

/**
 * GET /api/v1/users/:userId/permissions
 * Get user permissions
 */
router.get(
  '/:userId/permissions',
  authorize({ resource: 'user_permission', action: 'view' }),
  validate({ query: permissionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await userPermissionsService.getUserPermissions(
        companyId,
        req.params.userId,
        {
          module: req.query.module as string | undefined,
          branchId: req.query.branchId as string | undefined,
          resource: req.query.resource as string | undefined,
        }
      );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user permissions');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get user permissions',
      });
    }
  }
);

/**
 * GET /api/v1/users/:userId/permissions/check
 * Check if user has permission
 */
router.get(
  '/:userId/permissions/check',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { resource, action, module, branchId } = req.query;

      if (!resource || !action) {
        return void res.status(400).json({
          status: 'error',
          message: 'Resource and action are required',
        });
      }

      const hasPermission = await userPermissionsService.checkUserPermission(
        companyId,
        req.params.userId,
        resource as string,
        action as 'view' | 'edit' | 'delete' | 'approve' | 'post',
        {
          module: module as string | undefined,
          branchId: branchId as string | undefined,
        }
      );

      return void res.json({
        status: 'success',
        data: {
          hasPermission,
          userId: req.params.userId,
          resource,
          action,
          module,
          branchId,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error checking user permission');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check user permission',
      });
    }
  }
);

/**
 * POST /api/v1/users/:userId/advanced-permissions
 * Set advanced permissions (transfer/untransfer)
 */
router.post(
  '/:userId/advanced-permissions',
  authorize({ resource: 'user_permission', action: 'edit' }),
  validate({ body: advancedPermissionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Ensure userId in body matches URL param
      const data = {
        ...req.body,
        userId: req.params.userId,
      };

      const advancedPerms = await userPermissionsService.setAdvancedPermissions(
        companyId,
        data
      );

      logger.info(
        { companyId, userId: req.params.userId },
        'Advanced permissions set'
      );

      return void res.json({
        status: 'success',
        message: 'Advanced permissions set successfully',
        data: advancedPerms,
      });
    } catch (error) {
      logger.error({ error }, 'Error setting advanced permissions');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to set advanced permissions',
      });
    }
  }
);

/**
 * GET /api/v1/users/:userId/advanced-permissions
 * Get advanced permissions for user
 */
router.get(
  '/:userId/advanced-permissions',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const advancedPerms = await userPermissionsService.getAdvancedPermissions(
        companyId,
        req.params.userId,
        req.query.branchId as string | undefined
      );

      return void res.json({
        status: 'success',
        data: advancedPerms,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting advanced permissions');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get advanced permissions',
      });
    }
  }
);

/**
 * GET /api/v1/users/:userId/document-rights
 * Legacy `AdvancedRights` per-document-family post/unpost flags. Separate from
 * `/advanced-permissions` above, which carries the unrelated
 * transfer/untransfer shape in the same JSON column.
 */
router.get(
  '/:userId/document-rights',
  authorize({ resource: 'user_permission', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const rights = await advancedRightsService.getDocumentRights(
        companyId,
        req.params.userId,
        (req.query.branchId as string | undefined) ?? null
      );

      return void res.json({
        status: 'success',
        data: {
          userId: req.params.userId,
          // `null` means unprovisioned, which the service treats as unrestricted.
          documentRights: rights,
          families: LEGACY_ADVANCED_RIGHT_FAMILIES,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting document rights');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get document rights',
      });
    }
  }
);

/**
 * PUT /api/v1/users/:userId/document-rights
 * Provisions legacy AdvancedRights. Note the legacy posture: once ANY flag is
 * stored for a user, every family not explicitly `true` is denied for them.
 */
router.put(
  '/:userId/document-rights',
  authorize({ resource: 'user_permission', action: 'edit' }),
  validate({ body: documentRightsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const body = req.body as { branchId?: string | null; documentRights: Record<string, boolean> };
      const documentRights = await advancedRightsService.setDocumentRights(
        companyId,
        req.params.userId,
        body.branchId ?? null,
        body.documentRights
      );

      logger.info(
        { companyId, userId: req.params.userId, count: Object.keys(documentRights).length },
        'Document rights updated'
      );

      return void res.json({
        status: 'success',
        message: 'Document rights updated successfully',
        data: { userId: req.params.userId, documentRights },
      });
    } catch (error) {
      logger.error({ error }, 'Error setting document rights');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to set document rights',
      });
    }
  }
);

export default router;

