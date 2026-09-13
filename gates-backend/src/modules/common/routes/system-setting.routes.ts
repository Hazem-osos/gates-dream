import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  systemSettingQuerySchema,
  createSystemSettingSchema,
  updateSystemSettingSchema,
} from '../schemas/system-setting.schema';
import { systemSettingService } from '../services/system-setting.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

// Public route for public settings (no auth required)
router.get(
  '/public',
  async (_req, res: Response) => {
    try {
      const settings = await systemSettingService.getPublicSettings();
      return void res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting public system settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get public settings',
      });
    }
  }
);

// All other routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/system-settings
 * List system settings with filters
 */
router.get(
  '/',
  authorize({ resource: 'system-setting', action: 'view' }),
  validate({ query: systemSettingQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await systemSettingService.listSettings({
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        category: req.query.category as string | undefined,
        isPublic: req.query.isPublic as boolean | undefined,
        search: req.query.search as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.settings,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing system settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list system settings',
      });
    }
  }
);

/**
 * GET /api/v1/system-settings/:key
 * Get system setting by key
 */
router.get(
  '/:key',
  authorize({ resource: 'system-setting', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const setting = await systemSettingService.getSetting(req.params.key);

      return void res.json({
        status: 'success',
        data: setting,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting system setting');
      const statusCode = error instanceof Error && error.message === 'System setting not found' ? 404 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get system setting',
      });
    }
  }
);

/**
 * GET /api/v1/system-settings/category/:category
 * Get settings by category
 */
router.get(
  '/category/:category',
  authorize({ resource: 'system-setting', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const settings = await systemSettingService.getSettingsByCategory(req.params.category);

      return void res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting settings by category');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get settings by category',
      });
    }
  }
);

/**
 * POST /api/v1/system-settings
 * Create system setting
 */
router.post(
  '/',
  authorize({ resource: 'system-setting', action: 'edit' }),
  validate({ body: createSystemSettingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const setting = await systemSettingService.createSetting(req.body);

      return void res.status(201).json({
        status: 'success',
        data: setting,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating system setting');
      const statusCode = error instanceof Error && error.message.includes('Unique constraint') ? 409 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create system setting',
      });
    }
  }
);

/**
 * PUT /api/v1/system-settings/:key
 * Update system setting
 */
router.put(
  '/:key',
  authorize({ resource: 'system-setting', action: 'edit' }),
  validate({ body: updateSystemSettingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const setting = await systemSettingService.updateSetting(req.params.key, req.body);

      return void res.json({
        status: 'success',
        data: setting,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating system setting');
      const statusCode = error instanceof Error && error.message === 'System setting not found' ? 404 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update system setting',
      });
    }
  }
);

/**
 * DELETE /api/v1/system-settings/:key
 * Delete system setting
 */
router.delete(
  '/:key',
  authorize({ resource: 'system-setting', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      await systemSettingService.deleteSetting(req.params.key);

      return void res.json({
        status: 'success',
        message: 'System setting deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting system setting');
      const statusCode = error instanceof Error && error.message === 'System setting not found' ? 404 : 500;
      return void res.status(statusCode).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete system setting',
      });
    }
  }
);

export default router;

