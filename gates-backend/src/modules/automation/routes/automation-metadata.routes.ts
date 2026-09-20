/**
 * User-facing Automation Capability Catalog.
 *
 * GET /api/v1/automation/metadata — authenticated GATES session required
 * (any tenant may read the static catalog; there is nothing tenant-specific
 * or secret in it — no API keys, no n8n URLs, no credentials).
 */
import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { buildAutomationMetadata } from '../catalog/metadata.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/automation/metadata
 */
router.get(
  '/',
  authorize({ resource: 'automation-rule', action: 'view' }),
  async (_req: AuthRequest, res: Response) => {
    try {
      return void res.json({ status: 'success', data: buildAutomationMetadata() });
    } catch (error) {
      logger.error({ error }, 'Error building automation metadata');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: 'Failed to load automation metadata',
      });
    }
  }
);

export default router;
