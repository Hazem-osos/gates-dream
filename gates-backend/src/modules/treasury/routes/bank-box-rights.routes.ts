import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { AuthRequest } from '../../../shared/auth/types';
import { bankBoxRightsService } from '../services/bank-box-rights.service';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

function handleError(res: Response, error: unknown, fallback: string) {
  const status = error instanceof AppError ? error.statusCode : 500;
  if (status >= 500) logger.error({ error }, fallback);
  return void res.status(status).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  });
}

const setBankBoxRightsSchema = z.object({
  grants: z
    .array(
      z.object({
        safeId: z.string().uuid().optional().nullable(),
        bankAccountId: z.string().uuid().optional().nullable(),
        canPost: z.boolean(),
        canView: z.boolean().optional(),
      })
    )
    .default([]),
});

/** GET /api/v1/treasury/bank-box-rights/:userId — legacy `untBankBoxRights.pas` grid, ported. */
router.get(
  '/:userId',
  authorize({ resource: 'treasury', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await bankBoxRightsService.listForUser(companyId, req.params.userId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to load bank/box rights');
    }
  }
);

/** PUT /api/v1/treasury/bank-box-rights/:userId — delete-all-then-reinsert, matching legacy save. */
router.put(
  '/:userId',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const { grants } = setBankBoxRightsSchema.parse(req.body);
      const data = await bankBoxRightsService.setForUser(companyId, req.params.userId, grants);
      return void res.json({ status: 'success', message: 'تم حفظ صلاحيات الصناديق والبنوك بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to save bank/box rights');
    }
  }
);

export default router;
