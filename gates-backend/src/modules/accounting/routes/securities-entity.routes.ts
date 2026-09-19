import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { securitiesEntityService } from '../services/securities-entity.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../../../shared/cache/tenant-context.cache';

const router = Router();

const createSchema = z.object({
  arabicName: z.string().trim().min(1, 'أدخل اسم الجهة').max(191),
});

function allowEntityAccess(action: 'view' | 'edit') {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError(401, 'Authentication required');
      const companyId = req.companyId || req.tenantId || req.user.company_id;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const roles = req.user.realm_access?.roles || req.user.resource_access?.['gates-backend']?.roles || [];
      if (roles.includes('admin') || roles.includes('accountant')) return next();
      const cached = await getCachedUserPermissions(req.user.sub, companyId);
      const resources =
        action === 'view'
          ? ['securities-receipt', 'securities-payment', 'report', 'treasury', '*']
          : ['securities-receipt', 'securities-payment', '*'];
      const allowed = resources.some((resource) => permissionGrantedFromCache(cached, resource, action));
      if (!allowed) throw new AppError(403, 'Insufficient permissions');
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

router.get('/', allowEntityAccess('view'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await securitiesEntityService.list(companyId, req.query.search as string | undefined);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error listing securities entities');
    return void res.status(500).json({ status: 'error', message: 'تعذر تحميل الجهات' });
  }
});

router.post(
  '/',
  allowEntityAccess('edit'),
  validate({ body: createSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      const data = await securitiesEntityService.create(companyId, req.body.arabicName);
      return void res.status(201).json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'Error creating securities entity');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر حفظ الجهة',
      });
    }
  }
);

export default router;
