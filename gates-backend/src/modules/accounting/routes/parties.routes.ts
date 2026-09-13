import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { partyQuickSummaryService } from '../services/party-quick-summary.service';
import {
  partyQuickSummaryParamsSchema,
  partyQuickSummaryQuerySchema,
} from '../schemas/parties.schema';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/:id/quick-summary',
  authorize({ resource: 'customer', action: 'view' }),
  validate({ params: partyQuickSummaryParamsSchema, query: partyQuickSummaryQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const partyType = req.query.partyType as 'CUSTOMER' | 'SUPPLIER' | undefined;
      const data = await partyQuickSummaryService.getSummary(companyId, req.params.id, partyType);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'GET /parties/:id/quick-summary failed');
      const status = error instanceof Error && error.message === 'Party not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load party summary',
      });
    }
  }
);

export default router;
