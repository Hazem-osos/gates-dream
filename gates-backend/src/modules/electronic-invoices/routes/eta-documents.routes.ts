import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { etaInvoiceService } from '../services/eta-invoice.service';
import { eInvoiceSubmissionService } from '../services/e-invoice-submission.service';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

const batchSubmitSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(50),
});

router.get(
  '/queue',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await etaInvoiceService.listSubmissionQueue(companyId, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return void res.json({ status: 'success', data: data.rows, pagination: data.pagination });
  }
);

router.get(
  '/validate/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await etaInvoiceService.validateReadiness(companyId, req.params.invoiceId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Validation failed',
      });
    }
  }
);

router.get(
  '/preview/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const payload = await etaInvoiceService.buildFromInvoice(companyId, req.params.invoiceId);
      const contentHash = etaInvoiceService.hashDocument(
        payload as unknown as Record<string, unknown>
      );
      return void res.json({ status: 'success', data: { payload, contentHash } });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Preview failed',
      });
    }
  }
);

router.post(
  '/submit',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: batchSubmitSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }

    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'eta-submit-batch',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'eta-submit-batch' as const,
        invoiceIds: req.body.invoiceIds as string[],
      },
      'ETA batch submission queued'
    );
  }
);

router.post(
  '/submit/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'eta-submit-invoice',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'eta-submit-invoice' as const,
        invoiceId: req.params.invoiceId,
      },
      'ETA invoice submission queued'
    );
  }
);

router.post(
  '/status/:documentUuid/refresh',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'eta-poll-status',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'eta-poll-status' as const,
        documentUuid: req.params.documentUuid,
      },
      'ETA status poll queued'
    );
  }
);

router.get(
  '/status/:documentUuid',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    try {
      const data = await eInvoiceSubmissionService.getStatus(companyId, req.params.documentUuid);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Status failed',
      });
    }
  }
);

export default router;
