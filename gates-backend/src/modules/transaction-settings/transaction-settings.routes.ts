import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../shared/middleware/tenant.middleware';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/middleware/error-handler';
import type { AuthRequest } from '../../shared/auth/types';
import {
  documentTypeParamsSchema,
  updateTransactionSettingsSchema,
} from './transaction-settings.schema';
import { transactionSettingsService } from './transaction-settings.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

router.get(
  '/:documentType',
  authorize({ resource: 'company', action: 'view' }),
  validate({ params: documentTypeParamsSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const documentType = documentTypeParamsSchema.parse(req.params).documentType;
      const data = await transactionSettingsService.getOrCreate(requireCompanyId(req), documentType);
      return void res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:documentType',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ params: documentTypeParamsSchema, body: updateTransactionSettingsSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const documentType = documentTypeParamsSchema.parse(req.params).documentType;
      const data = await transactionSettingsService.update(
        requireCompanyId(req),
        documentType,
        req.body
      );
      return void res.json({ status: 'success', message: 'تم حفظ إعدادات المستند', data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
