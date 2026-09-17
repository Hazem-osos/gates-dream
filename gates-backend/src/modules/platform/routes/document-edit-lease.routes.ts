import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { documentEditLeaseBodySchema } from '../schemas/document-edit-lease.schema';
import {
  documentEditLeaseService,
  DocumentOccupiedError,
} from '../services/document-edit-lease.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyAndUser(req: AuthRequest): { companyId: string; userId: string } {
  const companyId = req.companyId || req.tenantId;
  const userId = req.user?.sub;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  if (!userId) throw new AppError(401, 'المستخدم غير معروف');
  return { companyId, userId };
}

function holderName(req: AuthRequest, fallback?: string): string {
  const fromBody = fallback?.trim();
  if (fromBody) return fromBody;
  return req.user?.username || req.user?.email || 'موظف بالشركة';
}

router.post(
  '/acquire',
  validate({ body: documentEditLeaseBodySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { companyId, userId } = requireCompanyAndUser(req);
      const lease = await documentEditLeaseService.acquire({
        companyId,
        resourceKey: req.body.resourceKey,
        userId,
        sessionId: req.body.sessionId,
        userName: holderName(req, req.body.userName),
      });
      return void res.json({ status: 'success', data: lease });
    } catch (error) {
      if (error instanceof DocumentOccupiedError) {
        return void res.status(409).json({
          status: 'error',
          code: 'DOCUMENT_OCCUPIED',
          message: error.message,
          data: { holderName: error.holderName },
        });
      }
      return next(error);
    }
  }
);

router.post(
  '/release',
  validate({ body: documentEditLeaseBodySchema.pick({ resourceKey: true, sessionId: true }) }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { companyId, userId } = requireCompanyAndUser(req);
      await documentEditLeaseService.release({
        companyId,
        resourceKey: req.body.resourceKey,
        userId,
        sessionId: req.body.sessionId,
      });
      return void res.json({ status: 'success' });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
