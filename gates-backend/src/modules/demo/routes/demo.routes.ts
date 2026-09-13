import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { hazemDemoSeedService } from '../hazem-demo-seed.service';
import { HAZEM_EMAIL } from '../data/hazem-demo.constants';

const router = Router();

/**
 * L5 fix (Item 41): this route seeds a full company + a `hazem@gmail.com`
 * user with a hardcoded ('12345', see `hazem-demo-seed.service.ts`)
 * password and grants it `resource: '*'` (every action) — reachable by
 * *any* authenticated caller with `account:edit`, with only a warning log
 * (no block) for non-hazem callers. Mounted unconditionally in `app.ts`, so
 * in production this amounted to a standing, committed-credential
 * super-admin backdoor. Demo-data seeding has no legitimate production use
 * case, so the whole route is disabled there — same pattern as
 * `anonymousApiContext`.
 */
function blockInProduction(_req: AuthRequest, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    next(new AppError(404, 'Not found'));
    return;
  }
  next();
}

router.use(blockInProduction);
router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/demo/seed-hazem
 * Idempotent rich demo dataset for hazem@gmail.com tenant. Non-production only.
 */
router.post(
  '/seed-hazem',
  authorize({ resource: 'account', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const email = req.user?.email?.toLowerCase();
      if (email && email !== HAZEM_EMAIL) {
        logger.warn({ email }, 'Non-hazem user triggered hazem demo seed');
      }

      const forceTransactions = req.body?.forceTransactions === true;
      const result = await hazemDemoSeedService.seed({ forceTransactions });

      return void res.json({
        status: 'success',
        message: result.skippedTransactions
          ? 'تم تحديث البيانات الأساسية — المعاملات موجودة مسبقاً (forceTransactions=true لإعادة البذر)'
          : 'تم إنشاء/تحديث بيانات العرض التجريبية',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Hazem demo seed failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to seed hazem demo data',
      });
    }
  }
);

export default router;
