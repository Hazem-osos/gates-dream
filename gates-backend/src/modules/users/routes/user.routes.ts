import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  updateSelfProfileSchema,
  userQuerySchema,
} from '../schemas/user.schema';
import { userService } from '../services/user.service';
import { authService } from '../../auth/services/auth.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import userPermissionsRoutes from './user-permissions.routes';
import permissionDefinitionsRoutes from './permission-definitions.routes';
import { userUiPreferencesSchema } from '../schemas/user-ui-preferences.schema';
import { userUiPreferencesService } from '../services/user-ui-preferences.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/users/me/ui-preferences — starred pages & UI prefs
 */
router.get('/me/ui-preferences', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.sub;
    const companyId = req.companyId || req.tenantId;
    if (!userId || !companyId) {
      return void res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    const data = await userUiPreferencesService.get(companyId, userId);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'GET /users/me/ui-preferences failed');
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load preferences',
    });
  }
});

/**
 * PUT /api/v1/users/me/ui-preferences
 */
router.put(
  '/me/ui-preferences',
  validate({ body: userUiPreferencesSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const companyId = req.companyId || req.tenantId;
      if (!userId || !companyId) {
        return void res.status(401).json({ status: 'error', message: 'Authentication required' });
      }
      const data = await userUiPreferencesService.save(companyId, userId, req.body);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'PUT /users/me/ui-preferences failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save preferences',
      });
    }
  }
);

/**
 * GET /api/v1/users/me — logged-in user profile (alias of auth profile shape)
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.sub;
    const companyId = req.companyId || req.tenantId;
    if (!userId) {
      return void res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    const profile = await authService.getProfile(userId, companyId);
    const jwtBranch = req.user?.branch_id ?? req.branchId ?? null;
    const permittedBranchIds = new Set(profile.branches.map((b) => b.id));
    profile.branchId =
      (jwtBranch && permittedBranchIds.has(jwtBranch) ? jwtBranch : null) ??
      profile.branches[0]?.id ??
      null;
    profile.roles =
      req.user?.realm_access?.roles ??
      req.user?.resource_access?.['gates-backend']?.roles ??
      (req.user?.role ? [req.user.role] : []);

    return void res.json({ status: 'success', data: profile });
  } catch (error) {
    logger.error({ error }, 'GET /users/me failed');
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load profile',
    });
  }
});

/**
 * PUT /api/v1/users/me
 */
router.put(
  '/me',
  validate({ body: updateSelfProfileSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const companyId = req.companyId || req.tenantId;
      if (!userId || !companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company and user context are required',
        });
      }
      const user = await userService.updateSelfProfile(companyId, userId, req.body);
      return void res.json({
        status: 'success',
        message: 'Profile updated',
        data: user,
      });
    } catch (error) {
      logger.error({ error }, 'PUT /users/me failed');
      const status =
        error instanceof Error && error.message.includes('already exists') ? 409 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update profile',
      });
    }
  }
);

/**
 * POST /api/v1/users/me/change-password
 */
router.post(
  '/me/change-password',
  validate({ body: changePasswordSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.sub;
      const companyId = req.companyId || req.tenantId;
      if (!userId || !companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company and user context are required',
        });
      }
      await userService.changePassword(
        companyId,
        userId,
        req.body.oldPassword,
        req.body.newPassword
      );
      return void res.json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      const status =
        error instanceof Error &&
        (error.message === 'User not found' ||
          error.message === 'Old password is incorrect')
          ? error.message === 'User not found'
            ? 404
            : 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  }
);

/**
 * GET /api/v1/users/sellers
 * Active program users for invoice / POS seller pickers.
 * Invoice clerks need this list; they may not have user:view.
 */
router.get(
  '/sellers',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const sellers = await userService.listSellers(companyId);
      return void res.json({
        status: 'success',
        data: sellers,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing sellers');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list sellers',
      });
    }
  }
);

/**
 * GET /api/v1/users
 * List users with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'user', action: 'view' }),
  validate({ query: userQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await userService.listUsers(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.users.length }, 'Users listed');

      return void res.json({
        status: 'success',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing users');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list users',
      });
    }
  }
);

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'user', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const user = await userService.getUserById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get user',
      });
    }
  }
);

/**
 * POST /api/v1/users
 * Create a new user
 */
router.post(
  '/',
  authorize({ resource: 'user', action: 'edit' }),
  validate({ body: createUserSchema }),
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

      const user = await userService.createUser(data);

      return void res.status(201).json({
        status: 'success',
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating user');
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
          error instanceof Error ? error.message : 'Failed to create user',
      });
    }
  }
);

/**
 * PUT /api/v1/users/:id
 * Update user
 */
router.put(
  '/:id',
  authorize({ resource: 'user', action: 'edit' }),
  validate({ body: updateUserSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const user = await userService.updateUser(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating user');
      const status =
        error instanceof Error &&
        (error.message === 'User not found' ||
          error.message.includes('already exists'))
          ? error.message === 'User not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update user',
      });
    }
  }
);

/**
 * DELETE /api/v1/users/:id
 * Delete user (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'user', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await userService.deleteUser(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting user');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete user',
      });
    }
  }
);

/**
 * PATCH /api/v1/users/:id/restore
 * Restore user (set isActive to true)
 */
router.patch(
  '/:id/restore',
  authorize({ resource: 'user', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const user = await userService.restoreUser(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'User restored successfully',
        data: user,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring user');
      const status =
        error instanceof Error && error.message === 'User not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to restore user',
      });
    }
  }
);

/**
 * POST /api/v1/users/:id/change-password
 * Change user password
 */
router.post(
  '/:id/change-password',
  authorize({ resource: 'user', action: 'edit' }),
  validate({ body: changePasswordSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await userService.changePassword(
        companyId,
        req.params.id,
        req.body.oldPassword,
        req.body.newPassword
      );

      return void res.json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error changing password');
      const status =
        error instanceof Error &&
        (error.message === 'User not found' ||
          error.message === 'Old password is incorrect')
          ? error.message === 'User not found'
            ? 404
            : 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to change password',
      });
    }
  }
);

// Mount user permissions routes
router.use('/', userPermissionsRoutes);

// Mount permission definitions routes
router.use('/permissions', permissionDefinitionsRoutes);

export default router;
