import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createLetterOfGuaranteeSettingsSchema,
  updateLetterOfGuaranteeSettingsSchema,
} from '../schemas/letter-of-guarantee-settings.schema';
import { letterOfGuaranteeSettingsService } from '../services/letter-of-guarantee-settings.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'letter-of-guarantee-settings', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await letterOfGuaranteeSettingsService.get(companyId);

      return void res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting letter of guarantee settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get letter of guarantee settings',
      });
    }
  }
);

router.put(
  '/',
  authorize({ resource: 'letter-of-guarantee-settings', action: 'edit' }),
  validate({ body: updateLetterOfGuaranteeSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await letterOfGuaranteeSettingsService.createOrUpdate(companyId, req.body);

      return void res.json({
        status: 'success',
        message: 'Letter of guarantee settings updated successfully',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating letter of guarantee settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update letter of guarantee settings',
      });
    }
  }
);

export default router;

