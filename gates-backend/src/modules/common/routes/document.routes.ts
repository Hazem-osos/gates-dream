import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import {
  documentConverterService,
  type DocumentConvertType,
} from '../services/document-converter.service';
import { documentNavigationService } from '../services/document-navigation.service';

const adjacentQuerySchema = z.object({
  entity: z.enum(['invoice', 'journal-entry', 'cash-transaction', 'issue', 'transfer']),
  currentId: z.string().uuid(),
  invoiceKind: z.string().optional(),
  transactionKind: z.string().optional(),
  fundType: z.enum(['CASHBOX', 'BANK_ACCOUNT']).optional(),
});

const convertSchema = z.object({
  type: z.enum([
    'PRICE_QUOTE_TO_SALE_INVOICE',
    'PRICE_QUOTE_TO_SALES_ORDER',
    'SALES_ORDER_TO_SALE_INVOICE',
    'PURCHASE_ORDER_TO_PURCHASE_INVOICE',
    'SALE_INVOICE_TO_ISSUE',
    'CLONE_INVOICE',
  ]),
  sourceId: z.string().uuid(),
});

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/navigation/adjacent',
  authorize({ resource: 'journal', action: 'view' }),
  validate({ query: adjacentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const data = await documentNavigationService.getAdjacentDocument(companyId, {
        entity: req.query.entity as never,
        currentId: String(req.query.currentId),
        invoiceKind: req.query.invoiceKind as string | undefined,
        transactionKind: req.query.transactionKind as string | undefined,
        fundType: req.query.fundType as never,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load adjacent documents',
      });
    }
  }
);

router.post(
  '/convert',
  authorize({ resource: 'journal', action: 'edit' }),
  validate({ body: convertSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const body = req.body as { type: DocumentConvertType; sourceId: string };
      const data = await documentConverterService.convert({
        companyId,
        branchId: req.branchId,
        fiscalYearId: req.fiscalYearId,
        userId: req.user?.sub,
        type: body.type,
        sourceId: body.sourceId,
      });

      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Document conversion failed',
      });
    }
  }
);

export default router;
