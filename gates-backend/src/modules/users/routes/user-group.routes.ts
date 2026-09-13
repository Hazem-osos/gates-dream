import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createUserGroupSchema,
  updateUserGroupSchema,
  addUserToGroupSchema,
  userGroupQuerySchema,
} from '../schemas/user-group.schema';
import { userGroupService } from '../services/user-group.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/user-groups
 * List user groups with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'user_group', action: 'view' }),
  validate({ query: userGroupQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await userGroupService.listUserGroups(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.userGroups.length },
        'User groups listed'
      );

      return void res.json({
        status: 'success',
        data: result.userGroups,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing user groups');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list user groups',
      });
    }
  }
);

/**
 * GET /api/v1/user-groups/:id
 * Get user group by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'user_group', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const userGroup = await userGroupService.getUserGroupById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: userGroup,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user group');
      const status =
        error instanceof Error && error.message === 'User group not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get user group',
      });
    }
  }
);

/**
 * POST /api/v1/user-groups
 * Create a new user group
 */
router.post(
  '/',
  authorize({ resource: 'user_group', action: 'edit' }),
  validate({ body: createUserGroupSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Ensure companyId in body matches authenticated company
      const data = {
        ...req.body,
        companyId: req.body.companyId || companyId,
      };

      const userGroup = await userGroupService.createUserGroup(data);

      return void res.status(201).json({
        status: 'success',
        message: 'User group created successfully',
        data: userGroup,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating user group');
      const status =
        error instanceof Error &&
        (error.message === 'Company not found' ||
          error.message.includes('already exists'))
          ? error.message === 'Company not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create user group',
      });
    }
  }
);

/**
 * PUT /api/v1/user-groups/:id
 * Update user group
 */
router.put(
  '/:id',
  authorize({ resource: 'user_group', action: 'edit' }),
  validate({ body: updateUserGroupSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const userGroup = await userGroupService.updateUserGroup(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'User group updated successfully',
        data: userGroup,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating user group');
      const status =
        error instanceof Error &&
        (error.message === 'User group not found' ||
          error.message.includes('already exists'))
          ? error.message === 'User group not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update user group',
      });
    }
  }
);

/**
 * DELETE /api/v1/user-groups/:id
 * Delete user group (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'user_group', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await userGroupService.deleteUserGroup(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting user group');
      const status =
        error instanceof Error &&
        (error.message === 'User group not found' ||
          error.message.includes('user(s) are members'))
          ? error.message === 'User group not found'
            ? 404
            : 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete user group',
      });
    }
  }
);

/**
 * PATCH /api/v1/user-groups/:id/restore
 * Restore user group (set isActive to true)
 */
router.patch(
  '/:id/restore',
  authorize({ resource: 'user_group', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const userGroup = await userGroupService.restoreUserGroup(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'User group restored successfully',
        data: userGroup,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring user group');
      const status =
        error instanceof Error && error.message === 'User group not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore user group',
      });
    }
  }
);

/**
 * POST /api/v1/user-groups/:id/users
 * Add user to group
 */
router.post(
  '/:id/users',
  authorize({ resource: 'user_group', action: 'edit' }),
  validate({ body: addUserToGroupSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const membership = await userGroupService.addUserToGroup(
        companyId,
        req.params.id,
        req.body.userId
      );

      return void res.status(201).json({
        status: 'success',
        message: 'User added to group successfully',
        data: membership,
      });
    } catch (error) {
      logger.error({ error }, 'Error adding user to group');
      const status =
        error instanceof Error &&
        (error.message === 'User group not found' ||
          error.message === 'User not found' ||
          error.message.includes('already'))
          ? error.message.includes('already')
            ? 409
            : 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add user to group',
      });
    }
  }
);

/**
 * DELETE /api/v1/user-groups/:id/users/:userId
 * Remove user from group
 */
router.delete(
  '/:id/users/:userId',
  authorize({ resource: 'user_group', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await userGroupService.removeUserFromGroup(
        companyId,
        req.params.id,
        req.params.userId
      );

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error removing user from group');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('does not belong'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to remove user from group',
      });
    }
  }
);

/**
 * GET /api/v1/user-groups/:id/users
 * Get users in group
 */
router.get(
  '/:id/users',
  authorize({ resource: 'user_group', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await userGroupService.getGroupUsers(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting group users');
      const status =
        error instanceof Error && error.message === 'User group not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get group users',
      });
    }
  }
);

export default router;

