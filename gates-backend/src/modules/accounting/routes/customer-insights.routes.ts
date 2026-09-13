import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { customerInsightsService } from '../services/customer-insights.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/:id/frequent-items',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const data = await customerInsightsService.getFrequentItems(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'GET /customers/:id/frequent-items failed');
      const status = error instanceof Error && error.message === 'Customer not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load frequent items',
      });
    }
  }
);

export default router;
