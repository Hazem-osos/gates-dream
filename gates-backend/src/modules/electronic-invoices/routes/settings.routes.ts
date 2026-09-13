import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { electronicInvoiceSettingsService } from '../services/settings.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/electronic-invoices/settings
 * Get electronic invoice settings
 */
router.get(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await electronicInvoiceSettingsService.getSettings(companyId);

      return void res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting electronic invoice settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get electronic invoice settings',
      });
    }
  }
);

/**
 * PUT /api/v1/electronic-invoices/settings
 * Update electronic invoice settings
 */
router.put(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await electronicInvoiceSettingsService.updateSettings(
        companyId,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Electronic invoice settings updated successfully',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating electronic invoice settings');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update electronic invoice settings',
      });
    }
  }
);

export default router;

