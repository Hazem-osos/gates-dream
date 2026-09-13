import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { cashTransactionService } from '../services/cash-transaction.service';

function requireCompanyId(req: AuthRequest, res: Response): string | null {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    res.status(400).json({ status: 'error', message: 'Company ID required' });
    return null;
  }
  return companyId;
}

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

async function toggleOrderExecution(
  req: AuthRequest,
  res: Response,
  expectedKind: 'PAYMENT' | 'RECEIPT'
) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  }
  const data = await cashTransactionService.toggleExecution(
    companyId,
    req.params.id,
    expectedKind,
    req.user?.sub
  );
  const completed = data.executionStatus === 'COMPLETED';
  const message =
    expectedKind === 'PAYMENT'
      ? completed
        ? 'تم تأكيد إتمام الصرف'
        : 'تم إرجاع الأمر إلى لم يتم الصرف'
      : completed
        ? 'تم تأكيد إتمام التوريد'
        : 'تم إرجاع الأمر إلى لم يتم التوريد';
  return void res.json({ status: 'success', data, message });
}

router.get(
  '/payment-orders',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const number = typeof req.query.number === 'string' ? req.query.number : undefined;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    if (departmentId || code || number) {
      const data = await cashTransactionService.findPaymentOrder(companyId, { code, number, departmentId });
      return void res.json({ status: 'success', data });
    }
    const result = await cashTransactionService.list(companyId, {
      documentRole: 'ORDER',
      transactionKind: 'PAYMENT',
      isCancelled: false,
      page: 1,
      limit: 50,
    });
    return void res.json({ status: 'success', data: result.items, pagination: result.pagination });
  })
);

router.get(
  '/receipt-orders',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = requireCompanyId(req, res);
    if (!companyId) return;
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const number = typeof req.query.number === 'string' ? req.query.number : undefined;
    if (code || number) {
      const data = await cashTransactionService.findReceiptOrder(companyId, { code, number });
      return void res.json({ status: 'success', data });
    }
    const result = await cashTransactionService.list(companyId, {
      documentRole: 'ORDER',
      transactionKind: 'RECEIPT',
      isCancelled: false,
      page: 1,
      limit: 50,
    });
    return void res.json({ status: 'success', data: result.items, pagination: result.pagination });
  })
);

router.patch(
  '/payment-orders/:id/toggle-execution',
  authorize({ resource: 'treasury', action: 'edit' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await toggleOrderExecution(req, res, 'PAYMENT');
  })
);

router.patch(
  '/receipt-orders/:id/toggle-execution',
  authorize({ resource: 'treasury', action: 'edit' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await toggleOrderExecution(req, res, 'RECEIPT');
  })
);

export default router;
