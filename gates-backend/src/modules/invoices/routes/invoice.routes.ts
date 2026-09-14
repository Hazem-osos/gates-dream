import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  tenantAndFiscalContextMiddleware,
  requirePostingContext,
} from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { requestPermittedBranchIds } from '../../../shared/auth/branch-scope';
import {
  createM5InvoiceSchema,
  m5InvoiceQuerySchema,
  settleM5InvoiceSchema,
  updateM5InvoiceSchema,
} from '../schemas/invoice-m5.schema';
import {
  collectInvoiceInstallmentSchema,
  invoiceInstallmentTrackerQuerySchema,
} from '../schemas/invoice-installment.schema';
import { invoiceInstallmentService } from '../services/invoice-installment.service';
import { invoiceM5Service } from '../services/invoice-m5.service';
import { invoicePostingOrchestrator } from '../services/invoice-posting-orchestrator';
import { invoiceSettlementService } from '../services/invoice-settlement.service';
// Was a byte-for-byte duplicate of the shared builder, minus the `isAdmin`
// flag that AdvancedRights needs for the legacy Admin bypass.
import { buildInvoicePostingContext as buildPostingContext } from '../services/invoice-posting-context';
import {
  keysetDirectionFromRequest,
  setKeysetPaginationHeaders,
  wantsKeysetPagination,
} from '../../../utils/pagination/keyset-headers';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';
import {
  listSourceDocumentsQuerySchema,
  sourceDocumentParamsSchema,
} from '../schemas/invoice-source.schema';
import { invoiceSourceService } from '../services/invoice-source.service';
import { listReturnableLines } from '../services/sales-return.service';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function requireCompany(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company context is required');
  return companyId;
}

function respondError(res: Response, e: unknown, fallback: string) {
  const status = e instanceof AppError ? e.statusCode : 500;
  return void res.status(status).json({
    status: 'error',
    message: e instanceof Error ? e.message : fallback,
  });
}

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: m5InvoiceQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID required' });
      }
      const result = await invoiceM5Service.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        cursor: req.query.cursor as string | undefined,
        direction: keysetDirectionFromRequest(req),
        invoiceKind: req.query.invoiceKind as never,
        isPosted: req.query.isPosted as boolean | undefined,
        includeLines: req.query.includeLines as boolean | undefined,
        search: req.query.search as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        customerId: req.query.customerId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        openOnly: req.query.openOnly as boolean | undefined,
        profileId: req.query.profileId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        permittedBranchIds: await requestPermittedBranchIds(req),
      });
      if (wantsKeysetPagination(req)) {
        setKeysetPaginationHeaders(res, result);
      }
      return void res.json({
        status: 'success',
        data: result.invoices,
        items: result.items,
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
        hasMore: result.hasMore,
        pagination: result.pagination,
      });
    } catch (e: unknown) {
      return respondError(res, e, 'List failed');
    }
  }
);

router.get(
  '/installments',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: invoiceInstallmentTrackerQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceInstallmentService.listTracker(requireCompany(req), req.query);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to load installment tracker');
    }
  }
);

router.get(
  '/sources/documents',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: listSourceDocumentsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await invoiceSourceService.listSourceDocuments(requireCompany(req), {
        type: req.query.type as never,
        search: req.query.search as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      return void res.json({
        status: 'success',
        data: result.items,
        pagination: result.pagination,
      });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to list source documents');
    }
  }
);

router.get(
  '/sources/:type/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ params: sourceDocumentParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceSourceService.getSourceDocumentForHydration(
        requireCompany(req),
        req.params.type as never,
        req.params.id
      );
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to load source document');
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createM5InvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID required' });
      }
      const data = await invoiceM5Service.create(
        companyId,
        req.branchId,
        req.fiscalYearId,
        req.body,
        req.user?.sub
      );
      return void res.status(201).json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Create failed');
    }
  }
);

router.post(
  '/bulk/post',
  authorize({ resource: 'invoice', action: 'post' }),
  validate({ body: z.object({ ids: z.array(z.string().uuid()).min(1).max(40) }) }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const ids = (req.body as { ids: string[] }).ids;
      const results: Array<{ id: string; ok: boolean; message?: string }> = [];
      for (const id of ids) {
        try {
          await invoicePostingOrchestrator.post(ctx, id);
          results.push({ id, ok: true });
        } catch (e) {
          results.push({
            id,
            ok: false,
            message: e instanceof Error ? e.message : 'Post failed',
          });
        }
      }
      return void res.json({ status: 'success', data: { results } });
    } catch (e: unknown) {
      return respondError(res, e, 'Bulk post failed');
    }
  }
);

router.post(
  '/:id/pdf',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      await invoiceM5Service.getById(companyId, req.params.id);
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Invoice not found' });
    }
    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.PDF_GENERATION,
      'invoice-pdf',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'invoice' as const,
        invoiceId: req.params.id,
      },
      'Invoice PDF queued'
    );
  }
);

router.get(
  '/:id/returnable-lines',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await listReturnableLines(requireCompany(req), req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'تعذر تحميل البنود القابلة للإرجاع');
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await invoiceM5Service.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Invoice not found' });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateM5InvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceM5Service.update(requireCompany(req), req.params.id, req.body, req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Update failed');
    }
  }
);

router.patch(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateM5InvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceM5Service.update(requireCompany(req), req.params.id, req.body, req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Update failed');
    }
  }
);

router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceM5Service.cancel(requireCompany(req), req.params.id, req.user?.sub);
      return void res.json({ status: 'success', data, message: 'Invoice cancelled' });
    } catch (e: unknown) {
      return respondError(res, e, 'Cancel failed');
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceM5Service.remove(requireCompany(req), req.params.id);
      return void res.json({ status: 'success', data, message: 'Invoice deleted' });
    } catch (e: unknown) {
      return respondError(res, e, 'Delete failed');
    }
  }
);

router.post(
  '/:id/post',
  // `requirePostingContext` existed but was mounted nowhere: it rejects a post
  // that arrives without an explicit branch and an *open* fiscal year, which is
  // what keeps a document off the ledger when the context is ambiguous.
  requirePostingContext,
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const result = await invoicePostingOrchestrator.post(ctx, req.params.id);
      return void res.json({ status: 'success', data: result });
    } catch (e: unknown) {
      return respondError(res, e, 'Post failed');
    }
  }
);

router.post(
  '/:id/unpost',
  requirePostingContext,
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const data = await invoicePostingOrchestrator.unpost(ctx, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Unpost failed');
    }
  }
);

router.post(
  '/:id/unapprove',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) throw new AppError(400, 'Company context is required');
      const data = await invoicePostingOrchestrator.unapprove(companyId, req.params.id);
      return void res.json({ status: 'success', data, message: 'تم إلغاء اعتماد المستند' });
    } catch (e: unknown) {
      return respondError(res, e, 'تعذر إلغاء الاعتماد');
    }
  }
);

router.get(
  '/:id/installments',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceInstallmentService.listByInvoice(requireCompany(req), req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to load invoice installments');
    }
  }
);

router.post(
  '/:id/installments/:installmentId/collect',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: collectInvoiceInstallmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const data = await invoiceInstallmentService.collect(
        ctx,
        req.params.id,
        req.params.installmentId,
        req.body
      );
      return void res.status(201).json({
        status: 'success',
        data,
        message: 'تم تسجيل سند القبض وربطه بالقسط',
      });
    } catch (e: unknown) {
      return respondError(res, e, 'Installment collection failed');
    }
  }
);

router.get(
  '/:id/settlements',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceSettlementService.list(requireCompany(req), req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to load settlements');
    }
  }
);

router.get(
  '/:id/settlements/cheques',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await invoiceSettlementService.listCheques(requireCompany(req), req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e: unknown) {
      return respondError(res, e, 'Failed to load cheques under collection');
    }
  }
);

router.post(
  '/:id/settlements',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: settleM5InvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const data = await invoiceSettlementService.settle(ctx, req.params.id, req.body);
      return void res.status(201).json({ status: 'success', data, message: 'Settlement posted' });
    } catch (e: unknown) {
      return respondError(res, e, 'Settlement failed');
    }
  }
);

router.post(
  '/:id/settlements/:settlementId/reverse',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const ctx = buildPostingContext(req);
      const data = await invoiceSettlementService.reverse(
        ctx,
        req.params.id,
        req.params.settlementId
      );
      return void res.json({ status: 'success', data, message: 'Settlement reversed' });
    } catch (e: unknown) {
      return respondError(res, e, 'Settlement reversal failed');
    }
  }
);

export default router;
