import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import {
  buildTreasuryPostingContext,
  resolveTreasuryPostingContext,
} from '../services/treasury-posting-context';
import { cashTransactionService, cashVoucherFamily } from '../services/cash-transaction.service';
import { treasuryPostingService } from '../services/treasury-posting.service';
import {
  cashDisbursementWorkflowService,
  normalizeFamily,
} from '../services/cash-disbursement-workflow.service';
import {
  createCashTransactionSchema,
  expectedVersionBodySchema,
  listCashTransactionsQuerySchema,
  updateCashTransactionSchema,
} from '../schemas/treasury.schema';
import prisma from '../../../shared/database/prisma';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.get(
  '/',
  authorize({ resource: 'treasury', action: 'view' }),
  validate({ query: listCashTransactionsQuerySchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const q = req.query as {
      page?: number;
      limit?: number;
      isPosted?: boolean;
      isCancelled?: boolean;
      isRecurring?: boolean;
      transactionKind?: 'RECEIPT' | 'PAYMENT';
      documentRole?: 'ORDER' | 'VOUCHER';
      departmentId?: string;
      fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
      voucherNumber?: string;
      search?: string;
      code?: string;
      number?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      executionStatus?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    };
    const result = await cashTransactionService.list(companyId, q);
    return void res.json({ status: 'success', data: result.items, pagination: result.pagination });
  })
);

router.get(
  '/posting-mode',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const family = normalizeFamily(typeof req.query.family === 'string' ? req.query.family : undefined) ?? 'BP01';
    const mode = await cashDisbursementWorkflowService.resolvePostingMode(companyId, family);
    return void res.json({ status: 'success', data: { mode, family } });
  })
);

router.post(
  '/',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: createCashTransactionSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const userId = req.user?.sub;
    const created = await cashTransactionService.create(
      companyId,
      req.branchId,
      req.fiscalYearId,
      req.body,
      userId
    );

    const isVoucher = (created.documentRole ?? 'VOUCHER') === 'VOUCHER';

    if (isVoucher) {
      const family = cashVoucherFamily(created);
      const mode = await cashDisbursementWorkflowService.resolvePostingMode(companyId, family);
      if (mode === 'MULTI') {
        const approvers = await cashDisbursementWorkflowService.seedApprovers(companyId);
        await prisma.cashTransaction.update({
          where: { id: created.id },
          data: {
            workflowStatus: 'PENDING_APPROVAL',
            approvalState: approvers,
          },
        });
      } else if (mode === 'AUTO' || isAdminRequest(req)) {
        try {
          const ctx = await resolveTreasuryPostingContext(req, created.date);
          const posted = await treasuryPostingService.postCashTransaction(ctx, created.id);
          return void res.status(201).json({
            status: 'success',
            data: posted,
            message: 'تم حفظ وترحيل السند تلقائياً',
          });
        } catch (err) {
          await cashTransactionService.rollbackUnposted(companyId, created.id);
          throw err;
        }
      }
    }

    const data = await cashTransactionService.getById(companyId, created.id);
    return void res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/:id/approvals',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await cashDisbursementWorkflowService.getApprovalReport(companyId, req.params.id);
    return void res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/approve',
  authorize({ resource: 'treasury', action: 'post' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    if (!req.user?.sub) {
      return void res.status(401).json({ status: 'error', message: 'User required' });
    }
    const data = await cashDisbursementWorkflowService.approve(companyId, req.params.id, req.user.sub);
    return void res.json({ status: 'success', data, message: 'تم اعتماد السند' });
  })
);

router.patch(
  '/:id',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: updateCashTransactionSchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await cashTransactionService.update(
      companyId,
      req.params.id,
      req.body,
      req.user?.sub
    );
    return void res.json({ status: 'success', data, message: 'تم تحديث السند' });
  })
);

router.post(
  '/:id/cancel',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: expectedVersionBodySchema }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await cashTransactionService.cancel(
      companyId,
      req.params.id,
      req.body?.expectedVersion
    );
    return void res.json({ status: 'success', data, message: 'تم إلغاء السند' });
  })
);

router.get(
  '/:id',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await cashTransactionService.getById(companyId, req.params.id);
    return void res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/post',
  authorize({ resource: 'treasury', action: 'post' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await treasuryPostingService.postCashTransaction(ctx, req.params.id);
    return void res.json({ status: 'success', data, message: 'Cash transaction posted' });
  })
);

router.post(
  '/:id/unpost',
  authorize({ resource: 'treasury', action: 'post' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await treasuryPostingService.unpostCashTransaction(ctx, req.params.id);
    return void res.json({ status: 'success', data, message: 'Cash transaction unposted' });
  })
);

export default router;
