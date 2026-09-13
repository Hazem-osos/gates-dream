import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { schoolSettingsSchema } from '../schemas/school-settings.schema';
import { schoolSettingsService } from '../services/school-settings.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'student', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await schoolSettingsService.getSchoolSettings(companyId);
      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting school settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get school settings',
      });
    }
  }
);

router.patch(
  '/',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: schoolSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await schoolSettingsService.saveSchoolSettings(companyId, req.body);
      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error saving school settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save school settings',
      });
    }
  }
);

export default router;
