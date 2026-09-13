import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  assignBranchPermissionSchema,
  assignBranchesPermissionSchema,
  removeBranchPermissionSchema,
} from '../schemas/branch-permissions.schema';
import { branchPermissionsService } from '../services/branch-permissions.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/companies/:companyId/branches/:branchId/permissions
 * Assign branch access to user
 */
router.post(
  '/:companyId/branches/:branchId/permissions',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: assignBranchPermissionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      const branchId = req.params.branchId;
      const userId = req.body.userId;

      if (!companyId || !branchId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID and Branch ID are required',
        });
      }

      const permission = await branchPermissionsService.assignBranchToUser(
        companyId,
        userId,
        branchId
      );

      logger.info({ companyId, userId, branchId }, 'Branch permission assigned');

      return void res.status(201).json({
        status: 'success',
        message: 'Branch permission assigned successfully',
        data: permission,
      });
    } catch (error) {
      logger.error({ error }, 'Error assigning branch permission');
      const status =
        error instanceof Error &&
        (error.message === 'Company not found' ||
          error.message === 'User not found' ||
          error.message === 'Branch not found' ||
          error.message.includes('already exists'))
          ? error.message.includes('already exists')
            ? 409
            : 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to assign branch permission',
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/branches/permissions/bulk
 * Assign multiple branches to user
 */
router.post(
  '/:companyId/branches/permissions/bulk',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: assignBranchesPermissionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await branchPermissionsService.assignBranchesToUser(
        companyId,
        req.body.userId,
        req.body.branchIds
      );

      logger.info(
        { companyId, userId: req.body.userId, count: result.count },
        'Branches assigned to user'
      );

      return void res.json({
        status: 'success',
        message: 'Branches assigned successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error assigning branches to user');
      const status =
        error instanceof Error &&
        (error.message === 'User not found' ||
          error.message.includes('not found'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to assign branches to user',
      });
    }
  }
);

/**
 * DELETE /api/v1/companies/:companyId/branches/:branchId/permissions
 * Remove branch access from user
 */
router.delete(
  '/:companyId/branches/:branchId/permissions',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: removeBranchPermissionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      const branchId = req.params.branchId;
      const userId = req.body.userId;

      if (!companyId || !branchId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID and Branch ID are required',
        });
      }

      await branchPermissionsService.removeBranchFromUser(
        companyId,
        userId,
        branchId
      );

      logger.info({ companyId, userId, branchId }, 'Branch permission removed');

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error removing branch permission');
      const status =
        error instanceof Error && error.message === 'Branch permission not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to remove branch permission',
      });
    }
  }
);

/**
 * GET /api/v1/companies/:companyId/users/:userId/branches
 * Get branches accessible by user
 */
router.get(
  '/:companyId/users/:userId/branches',
  authorize({ resource: 'branch', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      const userId = req.params.userId;

      if (!companyId || !userId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID and User ID are required',
        });
      }

      const result = await branchPermissionsService.getUserBranches(
        companyId,
        userId
      );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user branches');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get user branches',
      });
    }
  }
);

/**
 * GET /api/v1/companies/:companyId/branches/:branchId/users
 * Get users with access to branch
 */
router.get(
  '/:companyId/branches/:branchId/users',
  authorize({ resource: 'branch', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      const branchId = req.params.branchId;

      if (!companyId || !branchId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID and Branch ID are required',
        });
      }

      const result = await branchPermissionsService.getBranchUsers(
        companyId,
        branchId
      );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting branch users');
      const status =
        error instanceof Error && error.message === 'Branch not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get branch users',
      });
    }
  }
);

/**
 * GET /api/v1/companies/:companyId/branches/:branchId/users/:userId/check
 * Check if user has access to branch
 */
router.get(
  '/:companyId/branches/:branchId/users/:userId/check',
  authorize({ resource: 'branch', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      const branchId = req.params.branchId;
      const userId = req.params.userId;

      if (!companyId || !branchId || !userId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID, Branch ID, and User ID are required',
        });
      }

      const hasAccess = await branchPermissionsService.checkUserBranchAccess(
        companyId,
        userId,
        branchId
      );

      return void res.json({
        status: 'success',
        data: {
          hasAccess,
          userId,
          branchId,
          companyId,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error checking branch access');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check branch access',
      });
    }
  }
);

export default router;

