import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { hrPayrollSettingsSchema } from '../schemas/hr-settings.schema';
import { hrSettingsService } from '../services/hr-settings.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await hrSettingsService.getHrPayrollSettings(companyId);
      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting HR settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get HR settings',
      });
    }
  }
);

router.patch(
  '/',
  authorize({ resource: 'payroll', action: 'edit' }),
  validate({ body: hrPayrollSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await hrSettingsService.saveHrPayrollSettings(companyId, req.body);
      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error saving HR settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save HR settings',
      });
    }
  }
);

export default router;
