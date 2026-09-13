import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { companySettingsSchema } from '../schemas/company-settings.schema';
import { companySettingsService } from '../services/company-settings.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { getCompanySettingsEtag } from '../../../shared/services/master-catalog-version.service';
import { sendJsonWithEtag } from '../../../shared/http/master-data-etag';

const router = Router();

// Company settings routes typically require admin privileges
router.use(authenticate);

/**
 * GET /api/v1/companies/:companyId/settings
 * Get company settings
 */
router.get(
  '/:companyId/settings',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const settings = await companySettingsService.getCompanySettings(
        req.params.companyId
      );

      const etag = await getCompanySettingsEtag(req.params.companyId);
      sendJsonWithEtag(req, res, etag, {
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting company settings');
      const status =
        error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get company settings',
      });
    }
  }
);

/**
 * PUT /api/v1/companies/:companyId/settings
 * Update company settings
 */
router.put(
  '/:companyId/settings',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: companySettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const settings = await companySettingsService.updateCompanySettings(
        req.params.companyId,
        req.body
      );

      logger.info(
        { companyId: req.params.companyId },
        'Company settings updated'
      );

      return void res.json({
        status: 'success',
        message: 'Company settings updated successfully',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating company settings');
      const status =
        error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update company settings',
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/settings/reset
 * Reset company settings to defaults
 */
router.post(
  '/:companyId/settings/reset',
  authorize({ resource: 'company', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const settings = await companySettingsService.resetCompanySettings(
        req.params.companyId
      );

      logger.info(
        { companyId: req.params.companyId },
        'Company settings reset to defaults'
      );

      return void res.json({
        status: 'success',
        message: 'Company settings reset to defaults successfully',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error resetting company settings');
      const status =
        error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reset company settings',
      });
    }
  }
);

export default router;

