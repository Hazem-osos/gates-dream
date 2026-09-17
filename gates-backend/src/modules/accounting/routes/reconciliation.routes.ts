import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { reconciliationService } from '../services/reconciliation.service';
import {
  autoFifoReconcileSchema,
  manualReconcileSchema,
  openInvoicesQuerySchema,
} from '../schemas/reconciliation.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest) {
  const id = req.companyId ?? req.tenantId;
  if (!id) throw new AppError(400, 'Company ID is required');
  return id;
}

router.get(
  '/open-invoices',
  authorize({ resource: 'report', action: 'view' }),
  validate({ query: openInvoicesQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const q = req.query as unknown as {
        customerId?: string;
        supplierId?: string;
        accountId?: string;
        side?: 'receivable' | 'payable';
      };
      const data = await reconciliationService.listOpenInvoices(companyId(req), q);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to list open invoices',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'journal', action: 'edit' }),
  validate({ body: manualReconcileSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await reconciliationService.reconcileManual(companyId(req), req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Reconciliation failed',
      });
    }
  }
);

router.post(
  '/auto-fifo',
  authorize({ resource: 'journal', action: 'edit' }),
  validate({ body: autoFifoReconcileSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await reconciliationService.reconcileAutoFifo(
        companyId(req),
        req.body.cashTransactionId
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Auto FIFO reconciliation failed',
      });
    }
  }
);

export default router;
