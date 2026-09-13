import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { eInvoicePayloadBuilderService } from '../services/e-invoice-payload-builder.service';
import { eInvoiceSubmissionService } from '../services/e-invoice-submission.service';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

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
  '/submit-receipt/:posOrderId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'eta-submit-receipt',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'eta-submit-receipt' as const,
        posOrderId: req.params.posOrderId,
      },
      'ETA receipt submission queued'
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

router.post(
  '/cancel/:documentUuid',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const reason = (req.body?.reason as string) ?? 'Customer request';
    try {
      const data = await eInvoiceSubmissionService.cancelDocument(
        companyId,
        req.params.documentUuid,
        reason
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Cancel failed',
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
      const payload = await eInvoicePayloadBuilderService.buildFromM5Invoice(
        companyId,
        req.params.invoiceId
      );
      return void res.json({ status: 'success', data: payload });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Preview failed',
      });
    }
  }
);

export default router;
