import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { withholdingTaxPaymentSchema } from '../schemas/withholding-tax.schema';
import { withholdingTaxService } from '../services/withholding-tax.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/taxes/withholding-tax/pay
 * Process withholding tax payment
 */
router.post(
  '/pay',
  authorize({ resource: 'tax', action: 'edit' }),
  validate({ body: withholdingTaxPaymentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || '';

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const body = req.body as {
        supplierId: string;
        invoiceId?: string;
        paymentDate?: Date;
        gregorianDate?: Date;
        hijriDate?: string;
        taxAmount?: number;
        paid?: number | null;
        accountId: string;
        safeId?: string;
        bankAccountId?: string;
        currencyCode?: string;
        notes?: string;
        description?: string;
      };

      const paymentDate = body.paymentDate ?? body.gregorianDate ?? new Date();
      const taxAmount = body.taxAmount ?? body.paid ?? 0;
      if (!taxAmount || taxAmount <= 0) {
        return void res.status(400).json({
          status: 'error',
          message: 'taxAmount or paid must be a positive number',
        });
      }

      const result = await withholdingTaxService.processWithholdingTaxPayment(companyId, userId, {
        supplierId: body.supplierId,
        invoiceId: body.invoiceId,
        paymentDate,
        hijriDate: body.hijriDate,
        taxAmount,
        accountId: body.accountId,
        safeId: body.safeId,
        bankAccountId: body.bankAccountId,
        currencyCode: body.currencyCode,
        notes: body.notes ?? body.description,
      });

      return void res.status(201).json({
        status: 'success',
        message: 'Withholding tax payment processed successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error processing withholding tax payment');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process withholding tax payment',
      });
    }
  }
);

/**
 * GET /api/v1/taxes/withholding-tax/history
 * Get withholding tax payment history
 */
router.get(
  '/history',
  authorize({ resource: 'tax', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const supplierId = req.query.supplierId as string | undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;

      const history = await withholdingTaxService.getWithholdingTaxHistory(
        companyId,
        supplierId,
        fromDate,
        toDate
      );

      return void res.json({
        status: 'success',
        data: history,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting withholding tax history');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get withholding tax history',
      });
    }
  }
);

export default router;

