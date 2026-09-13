import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { updateAccountingSettingsSchema } from './accounting-settings.schema';
import { accountingSettingsService } from './accounting-settings.factory';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'Company ID is required');
  }
  return companyId;
}

/**
 * GET /api/v1/accounting/settings
 * Tenant-scoped accounting settings facade (JWT companyId only).
 */
router.get(
  '/',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await accountingSettingsService.getSettings(requireCompanyId(req));
      return void res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/accounting/settings
 * Partial deep-merge. Never accepts companyId from the body.
 */
router.put(
  '/',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: updateAccountingSettingsSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = requireCompanyId(req);
      const userId = req.user?.sub;
      if (!userId) {
        throw new AppError(401, 'Authenticated user is required');
      }
      const data = await accountingSettingsService.updateSettings(
        { companyId, userId, branchId: req.branchId },
        req.body
      );
      return void res.json({
        status: 'success',
        message: 'Accounting settings updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
