/**
 * User-facing Automation Template Catalog — pre-filled rule definitions.
 * GET /api/v1/automation/templates
 */
import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AUTOMATION_TEMPLATES } from '../catalog/templates';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/automation/templates
 */
router.get(
  '/',
  authorize({ resource: 'automation-rule', action: 'view' }),
  async (_req: AuthRequest, res: Response) => {
    try {
      return void res.json({ status: 'success', data: AUTOMATION_TEMPLATES });
    } catch (error) {
      logger.error({ error }, 'Error listing automation templates');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: 'Failed to load automation templates',
      });
    }
  }
);

export default router;
