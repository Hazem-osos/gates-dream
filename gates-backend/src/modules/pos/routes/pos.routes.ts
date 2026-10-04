// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import { Router, Request, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { dailyPOSReportQuerySchema } from '../schemas/pos.schema';
import { posService } from '../services/pos.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

export const LEGACY_POS_RETIRED =
  'مسار نقطة البيع القديم متوقف. الترحيل يتم من أمر نقطة البيع فقط.';

/** Retired invoice and stock writes. PosOrder is the only POS financial path. */
export function legacyPosGone(_req: Request, res: Response) {
  return void res.status(410).json({
    status: 'error',
    message: LEGACY_POS_RETIRED,
  });
}

router.use(authenticate);
router.use(setTenantContext);

router.post('/sales', legacyPosGone);
router.get('/sales', legacyPosGone);
router.get('/sales/:id', legacyPosGone);
router.post('/sales/:id/cancel', legacyPosGone);
router.post('/sales/:id/print-receipt', legacyPosGone);
router.post('/inventory/update-real-time', legacyPosGone);

/**
 * GET /api/v1/pos/daily-report
 * Posted PosOrder rows only.
 */
router.get(
  '/daily-report',
  authorize({ resource: 'pos', action: 'view' }),
  validate({ query: dailyPOSReportQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const report = await posService.getDailyPOSReport({
        companyId,
        date: req.query.date as Date,
        warehouseId: req.query.warehouseId as string | undefined,
        sellerId: req.query.sellerId as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: report.sales,
        summary: report.summary,
        date: report.date,
        historicalLimitation: report.historicalLimitation,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting daily POS report');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get daily POS report',
      });
    }
  }
);

export default router;
