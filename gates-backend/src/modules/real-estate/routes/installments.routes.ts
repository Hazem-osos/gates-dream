import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { unitContractService } from '../services/unit-contract.service';
import { lateFeeCalculationService } from '../services/late-fee-calculation.service';
import { validateBody, validateParams } from '../../../shared/middleware/validate';
import { idParamSchema, settleInstallmentSchema } from '../schemas/real-estate.validation';
import prisma from '../../../shared/database/prisma';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function postingContext(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID required');
  return journalEntryService.buildPostingContext(
    companyId,
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const row = await prisma.unitInstallment.findFirst({
        where: { id: req.params.id, contract: { companyId } },
      });
      if (!row) throw new AppError(404, 'Installment not found');
      return void res.json({ status: 'success', data: row });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Get installment failed',
      });
    }
  }
);

router.post(
  '/:id/settle',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(settleInstallmentSchema),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const body = req.body as {
        paymentAmount: string | number;
        paymentDate?: Date;
        allocation?: 'LATE_FEES_FIRST' | 'PRINCIPAL_FIRST';
        paymentMethod?: string;
        pdcChequeId?: string;
      };
      const data = await lateFeeCalculationService.settleInstallmentPayment(
        companyId,
        req.params.id,
        body.paymentAmount,
        {
          allocation: body.allocation,
          asOfDate: body.paymentDate,
          paymentTransactionId: body.pdcChequeId,
        }
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Settle installment failed',
      });
    }
  }
);

router.post(
  '/:id/collect',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const ctx = postingContext(req);
      const treasuryCtx = buildTreasuryPostingContext(req);
      const body = req.body as {
        safeId?: string;
        bankAccountId?: string;
        collectionDate?: string;
        voucherNumber?: string;
      };
      const data = await unitContractService.collectInstallment(
        ctx,
        treasuryCtx,
        req.params.id,
        {
          safeId: body.safeId,
          bankAccountId: body.bankAccountId,
          collectionDate: body.collectionDate ? new Date(body.collectionDate) : undefined,
          voucherNumber: body.voucherNumber,
        }
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Collect installment failed',
      });
    }
  }
);

export default router;
