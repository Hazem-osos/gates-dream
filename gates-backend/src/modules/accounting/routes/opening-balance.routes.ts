import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { logger } from '../../../shared/logger';
import { openingBalanceService } from '../services/opening-balance.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);
router.use(tenantAndFiscalContextMiddleware);

/**
 * GET /api/v1/accounting/opening-balance
 * Locked opening-balance date (day before first fiscal year) + latest lines.
 */
router.get(
  '/',
  authorize({ resource: 'journal-entry', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = await openingBalanceService.getOpeningBalance(companyId);
      return void res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'Error resolving opening balance metadata');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      return void res.status(500).json({
        status: 'error',
        message: 'تعذر تحديد تاريخ الرصيد الافتتاحي',
      });
    }
  }
);

export default router;
