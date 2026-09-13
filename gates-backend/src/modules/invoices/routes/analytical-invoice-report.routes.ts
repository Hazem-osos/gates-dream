import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { analyticalInvoiceMovementQuerySchema } from '../schemas/invoice-source.schema';
import { invoiceSourceService } from '../services/invoice-source.service';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function requireCompany(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company context is required');
  return companyId;
}

router.get(
  '/analytical-invoice-movement',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: analyticalInvoiceMovementQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await invoiceSourceService.getAnalyticalInvoiceMovement(requireCompany(req), {
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        sourceType: req.query.sourceType as never,
        partyId: req.query.partyId as string | undefined,
        status: req.query.status as never,
        search: req.query.search as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
      });
      return void res.json({
        status: 'success',
        data: result.rows,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (e: unknown) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load analytical invoice movement',
      });
    }
  }
);

export default router;
