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
import { esignSigningSessionService } from '../services/esign-signing-session.service';
import { EsignFlowError } from '../utils/esign-flow-error';
import { publicEsignDiagnostics } from '../utils/esign-submit-diagnostics';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

const batchSubmitSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(50),
});

const submitSignedSchema = z.object({
  contentHash: z.string().min(16),
  signature: z.string().min(80),
});

const prepareAgentSignSchema = z.object({
  deviceId: z.string().min(8),
  signingMethod: z.literal('LOCAL_USB_AGENT').optional(),
});

const completeSignSchema = z.object({
  signingSessionId: z.string().uuid(),
  requestId: z.string().min(8).optional(),
  documentHash: z.string().min(16),
  signature: z.string().min(80),
  certificateThumbprint: z.string().min(8).optional(),
});

router.get(
  '/readiness',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const invoiceKind =
      req.query.invoiceKind === 'SALE' || req.query.invoiceKind === 'SALE_RETURN'
        ? req.query.invoiceKind
        : undefined;
    const mode = req.query.mode === 'amended' ? 'amended' : 'new';
    const id = (value: unknown) => {
      const text = typeof value === 'string' ? value.trim() : '';
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
        ? text
        : undefined;
    };
    const invoiceNumber = String(req.query.invoiceNumber ?? '').trim().slice(0, 50);
    const data = await etaInvoiceService.listInvoiceReadiness(companyId, {
      fromDate: req.query.fromDate ? new Date(String(req.query.fromDate)) : undefined,
      toDate: req.query.toDate
        ? new Date(`${String(req.query.toDate).slice(0, 10)}T23:59:59.999`)
        : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      invoiceKind,
      mode,
      customerId: id(req.query.customerId),
      delegateId: id(req.query.delegateId),
      warehouseId: id(req.query.warehouseId),
      branchId: id(req.query.branchId),
      itemId: id(req.query.itemId),
      itemGroupId: id(req.query.itemGroupId),
      costCenterId: id(req.query.costCenterId),
      profileId: id(req.query.profileId),
      invoiceNumber: invoiceNumber || undefined,
    });
    return void res.json({
      status: 'success',
      data: data.rows,
      summary: data.summary,
      pagination: data.pagination,
    });
  }
);

router.get(
  '/invoice/:invoiceId/status',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const data = await etaInvoiceService.getInvoiceEtaStatus(companyId, req.params.invoiceId);
    if (!data) {
      return void res.status(404).json({ status: 'error', message: 'الفاتورة غير موجودة' });
    }
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/queue',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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

function displayFromUnsigned(unsigned: Record<string, unknown>) {
  const issuer =
    unsigned.issuer && typeof unsigned.issuer === 'object'
      ? (unsigned.issuer as { name?: string })
      : {};
  return {
    companyName: issuer.name,
    internalId: typeof unsigned.internalID === 'string' ? unsigned.internalID : undefined,
    amount:
      unsigned.totalAmount != null
        ? String(unsigned.totalAmount)
        : unsigned.netAmount != null
          ? String(unsigned.netAmount)
          : undefined,
    documentType: typeof unsigned.documentType === 'string' ? unsigned.documentType : undefined,
  };
}

function esignSubmitErrorBody(error: unknown, fallback: string) {
  const diagnostics =
    error instanceof EsignFlowError && error.diagnostics
      ? publicEsignDiagnostics(error.diagnostics)
      : undefined;
  return {
    status: 'error' as const,
    code: error instanceof AppError && 'code' in error ? (error as { code?: string }).code : undefined,
    message: error instanceof Error ? error.message : fallback,
    ...(diagnostics ?? {}),
  };
}

router.post(
  '/prepare-sign/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: prepareAgentSignSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const prepared = await eInvoiceSubmissionService.prepareM5InvoiceForLocalSign(
        companyId,
        req.params.invoiceId,
        userId
      );
      const data = await esignSigningSessionService.createAuthorizedSession({
        companyId,
        userId,
        deviceId: req.body.deviceId,
        invoiceId: prepared.invoiceId,
        documentId: prepared.documentId,
        documentType: prepared.documentType,
        unsigned: prepared.unsignedPayload,
        display: displayFromUnsigned(prepared.unsignedPayload),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        code: e instanceof AppError && 'code' in e ? (e as { code?: string }).code : undefined,
        message: e instanceof Error ? e.message : 'Prepare failed',
      });
    }
  }
);

router.post(
  '/prepare-amendment/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: prepareAgentSignSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const prepared = await eInvoiceSubmissionService.prepareM5AmendmentForLocalSign(
        companyId,
        req.params.invoiceId,
        userId
      );
      const data = await esignSigningSessionService.createAuthorizedSession({
        companyId,
        userId,
        deviceId: req.body.deviceId,
        invoiceId: prepared.invoiceId,
        documentId: prepared.documentId,
        documentType: prepared.documentType,
        unsigned: prepared.unsignedPayload,
        display: displayFromUnsigned(prepared.unsignedPayload),
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        code: e instanceof AppError && 'code' in e ? (e as { code?: string }).code : undefined,
        message: e instanceof Error ? e.message : 'Prepare failed',
      });
    }
  }
);

router.post(
  '/complete-sign',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: completeSignSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await esignSigningSessionService.completeSign(companyId, userId, req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json(esignSubmitErrorBody(e, 'Signed submit failed'));
    }
  }
);

router.post(
  '/retry-submit/:signingSessionId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await esignSigningSessionService.retrySubmit(
        companyId,
        userId,
        req.params.signingSessionId
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json(esignSubmitErrorBody(e, 'Retry submit failed'));
    }
  }
);

router.post(
  '/submit-signed/:documentId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: submitSignedSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await eInvoiceSubmissionService.submitPreparedSignedDocument(
        companyId,
        req.params.documentId,
        { ...req.body, actorUserId: req.user?.sub }
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Signed submit failed',
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
  '/submit-amendment',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: batchSubmitSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }

    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'eta-submit-amendment-batch',
      {
        companyId,
        userId: req.user?.sub ?? 'system',
        kind: 'eta-submit-amendment-batch' as const,
        invoiceIds: req.body.invoiceIds as string[],
      },
      'ETA amendment submission queued'
    );
  }
);

router.post(
  '/submit/:invoiceId',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
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
