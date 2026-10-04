import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import {
  parseStoreDocumentKind,
  peekStoreDocumentNextSerial,
} from '../services/store-document-numbering.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/store-documents/next-number?kind=stocktaking|transfer|...
 */
router.get(
  '/next-number',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const kind = parseStoreDocumentKind(String(req.query.kind ?? ''));
      if (!kind) {
        return void res.status(400).json({
          status: 'error',
          message: 'نوع المستند غير صالح',
        });
      }

      const data = await peekStoreDocumentNextSerial({
        companyId,
        branchId: req.branchId ?? null,
        fiscalYearId: req.fiscalYearId ?? null,
        kind,
      });

      return void res.json({ status: 'success', data });
    } catch (error) {
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({ status: 'error', message: error.message });
      }
      logger.error({ error }, 'Failed to preview store document number');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'فشل معاينة مسلسل المستند',
      });
    }
  }
);

export default router;
