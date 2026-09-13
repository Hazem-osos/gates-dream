import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { setTenantContext } from '../../shared/middleware/tenant.middleware';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import type { AuthRequest } from '../../shared/auth/types';
import { AppError } from '../../shared/middleware/error-handler';
import { whatsAppShareService } from './whatsapp-share.service';

const invoiceParam = z.object({ id: z.string().min(1) });
const statementBody = z.object({
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  phone: z.string().optional(),
});

export const authenticatedShareRouter = Router();
authenticatedShareRouter.use(authenticate);
authenticatedShareRouter.use(setTenantContext);

authenticatedShareRouter.post(
  '/invoice/:id',
  validate({ params: invoiceParam }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) throw new AppError(400, 'Company context is required');
    const data = await whatsAppShareService.createInvoiceShare(
      companyId,
      req.params.id,
      typeof req.body?.phone === 'string' ? req.body.phone : undefined
    );
    return void res.json({ status: 'success', data });
  })
);

authenticatedShareRouter.post(
  '/statement',
  validate({ body: statementBody }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) throw new AppError(400, 'Company context is required');
    const data = await whatsAppShareService.createStatementShare(companyId, req.body, req.body.phone);
    return void res.json({ status: 'success', data });
  })
);

export const publicShareRouter = Router();
publicShareRouter.get(
  '/:token',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await whatsAppShareService.resolvePublic(req.params.token);
    return void res.json({ status: 'success', data });
  })
);
