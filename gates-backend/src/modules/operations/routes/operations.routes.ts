import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import {
  batchOperationsService,
  type BatchDocumentType,
} from '../services/batch-operations.service';
import { yearEndClosingService } from '../services/year-end-closing.service';
import { isAdminRequest } from '../../../shared/auth/roles.util';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

const batchBodySchema = z.object({
  documentType: z.enum(['JOURNAL_ENTRY', 'INVOICE', 'TREASURY', 'POS_SHIFT']),
  fromDate: z.string(),
  toDate: z.string(),
  branchId: z.string().optional(),
  fiscalYearId: z.string().optional(),
  sourceFrom: z.string().optional(),
  sourceTo: z.string().optional(),
});

function parseIsoDate(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Invalid ${field}`);
  return d;
}

function journalCtx(req: AuthRequest) {
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

router.post(
  '/batch-post',
  authorize({ resource: 'journal', action: 'post' }),
  validate({ body: batchBodySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID required');

      const body = req.body as z.infer<typeof batchBodySchema>;
      const data = await batchOperationsService.batchPost(
        journalCtx(req),
        buildTreasuryPostingContext(req),
        {
          companyId,
          documentType: body.documentType as BatchDocumentType,
          fromDate: parseIsoDate(body.fromDate, 'fromDate'),
          toDate: parseIsoDate(body.toDate, 'toDate'),
          branchId: body.branchId ?? req.branchId,
          fiscalYearId: body.fiscalYearId ?? req.fiscalYearId,
          sourceFrom: body.sourceFrom,
          sourceTo: body.sourceTo,
        }
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Batch post failed',
      });
    }
  }
);

router.post(
  '/batch-unpost',
  authorize({ resource: 'journal', action: 'post' }),
  validate({ body: batchBodySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID required');

      const body = req.body as z.infer<typeof batchBodySchema>;
      const data = await batchOperationsService.batchUnpost(
        journalCtx(req),
        buildTreasuryPostingContext(req),
        {
          companyId,
          documentType: body.documentType as BatchDocumentType,
          fromDate: parseIsoDate(body.fromDate, 'fromDate'),
          toDate: parseIsoDate(body.toDate, 'toDate'),
          branchId: body.branchId ?? req.branchId,
          fiscalYearId: body.fiscalYearId ?? req.fiscalYearId,
          sourceFrom: body.sourceFrom,
          sourceTo: body.sourceTo,
        }
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Batch unpost failed',
      });
    }
  }
);

router.post(
  '/fiscal-years/:id/close',
  authorize({ resource: 'journal', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await yearEndClosingService.closeFiscalYear(
        journalCtx(req),
        req.params.id
      );
      return void res.json({ status: 'success', data, message: 'Fiscal year closed' });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Year-end close failed',
      });
    }
  }
);

router.post(
  '/fiscal-years/:id/reopen',
  authorize({ resource: 'journal', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await yearEndClosingService.reopenFiscalYear(
        journalCtx(req),
        req.params.id
      );
      return void res.json({ status: 'success', data, message: 'Fiscal year reopened' });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Fiscal year reopen failed',
      });
    }
  }
);

export default router;
