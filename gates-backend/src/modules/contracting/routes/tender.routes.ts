import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { uploadExcelMemory } from '../excel/excel-upload.middleware';
import { contractTenderAwardService } from '../tender/contract-tender-award.service';
import { contractTenderBoqService } from '../tender/contract-tender-boq.service';
import { contractTenderIntegrityService } from '../tender/contract-tender-integrity.service';
import { contractTenderPricingService } from '../tender/contract-tender-pricing.service';
import { contractTenderQuotationService } from '../tender/contract-tender-quotation.service';
import { contractTenderService } from '../tender/contract-tender.service';
import { tenderBoqExcelService } from '../tender/tender-boq-excel.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function cid(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

router.get('/', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: await contractTenderService.list(cid(req as AuthRequest)) });
}));

router.post('/', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const auth = req as AuthRequest;
  const body = req.body as { customerId: string; nameAr: string; description?: string; currencyCode?: string };
  const data = await contractTenderService.create(cid(auth), { ...body, createdBy: auth.userId });
  res.status(201).json({ status: 'success', data });
}));

router.patch(
  '/:tenderId',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const data = await contractTenderService.update(cid(req as AuthRequest), req.params.tenderId, {
      nameAr: body.nameAr as string | undefined,
      description: body.description as string | null | undefined,
      currencyCode: body.currencyCode as string | undefined,
      submissionDeadline: body.submissionDeadline ? new Date(String(body.submissionDeadline)) : body.submissionDeadline === null ? null : undefined,
      expectedStart: body.expectedStart ? new Date(String(body.expectedStart)) : body.expectedStart === null ? null : undefined,
      expectedEnd: body.expectedEnd ? new Date(String(body.expectedEnd)) : body.expectedEnd === null ? null : undefined,
      location: body.location as string | null | undefined,
    });
    res.json({ status: 'success', data });
  })
);

router.post('/:tenderId/lost', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderService.markLost(cid(req as AuthRequest), req.params.tenderId, req.body),
  });
}));

router.post('/:tenderId/boq', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderBoqService.upsertLine(cid(req as AuthRequest), req.params.tenderId, req.body),
  });
}));

router.delete('/boq/:lineId', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: await contractTenderBoqService.deleteLine(cid(req as AuthRequest), req.params.lineId) });
}));

router.get('/:tenderId/pricing/summary', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderPricingService.getSummary(cid(req as AuthRequest), req.params.tenderId),
  });
}));

router.post('/:tenderId/pricing/markup', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const { markupRate } = req.body as { markupRate: number };
  res.json({
    status: 'success',
    data: await contractTenderPricingService.applyDefaultMarkup(cid(req as AuthRequest), req.params.tenderId, markupRate),
  });
}));

router.post('/boq/:lineId/rate-analysis', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const { items } = req.body as { items: never[] };
  res.json({
    status: 'success',
    data: await contractTenderPricingService.upsertRateAnalysis(cid(req as AuthRequest), req.params.lineId, items),
  });
}));

router.post('/boq/:lineId/direct-cost', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const { directUnitCost } = req.body as { directUnitCost: number };
  res.json({
    status: 'success',
    data: await contractTenderPricingService.setDirectUnitCost(cid(req as AuthRequest), req.params.lineId, directUnitCost),
  });
}));

router.post('/boq/:lineId/pricing', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const body = req.body as {
    pricingMethod: 'MANUAL_SELLING' | 'COST_PLUS_MARKUP' | 'TARGET_MARGIN';
    markupRate?: number;
    targetMarginRate?: number;
    sellingUnitRate?: number;
  };
  const data = await contractTenderPricingService.setLinePricing(
    cid(req as AuthRequest),
    req.params.lineId,
    body
  );
  res.json({ status: 'success', data });
}));

router.post('/:tenderId/quotations', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const auth = req as AuthRequest;
  res.status(201).json({
    status: 'success',
    data: await contractTenderQuotationService.createRevision(cid(auth), req.params.tenderId, auth.userId),
  });
}));

router.get('/:tenderId/quotations', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.list(cid(req as AuthRequest), req.params.tenderId),
  });
}));

router.get('/quotations/:quotationId', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.get(cid(req as AuthRequest), req.params.quotationId),
  });
}));

router.patch('/quotations/:quotationId', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.updateDraft(cid(req as AuthRequest), req.params.quotationId, {
      discountAmount: body.discountAmount != null ? Number(body.discountAmount) : undefined,
      validUntil: body.validUntil ? new Date(String(body.validUntil)) : body.validUntil === null ? null : undefined,
      paymentTerms: body.paymentTerms as string | null | undefined,
      deliveryTerms: body.deliveryTerms as string | null | undefined,
      notes: body.notes as string | null | undefined,
    }),
  });
}));

router.post('/quotations/:quotationId/reject', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.reject(cid(req as AuthRequest), req.params.quotationId),
  });
}));

router.post('/quotations/:quotationId/submit', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.submit(cid(req as AuthRequest), req.params.quotationId),
  });
}));

router.post('/quotations/:quotationId/accept', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.accept(cid(req as AuthRequest), req.params.quotationId),
  });
}));

router.post('/quotations/:quotationId/line-rate', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const { tenderBoqItemId, sellingUnitRate } = req.body as { tenderBoqItemId: string; sellingUnitRate: number };
  res.json({
    status: 'success',
    data: await contractTenderQuotationService.updateDraftLineRate(
      cid(req as AuthRequest),
      req.params.quotationId,
      tenderBoqItemId,
      sellingUnitRate
    ),
  });
}));

router.post('/:tenderId/award', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const auth = req as AuthRequest;
  const body = req.body as { quotationId: string; idempotencyKey?: string; projectCode?: string };
  res.json({
    status: 'success',
    data: await contractTenderAwardService.award(cid(auth), req.params.tenderId, body.quotationId, {
      idempotencyKey: body.idempotencyKey,
      awardedBy: auth.userId,
      projectCode: body.projectCode,
    }),
  });
}));

router.post(
  '/:tenderId/boq/excel/preview',
  authorize({ resource: 'project', action: 'edit' }),
  uploadExcelMemory,
  asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw new AppError(400, 'لم يتم رفع ملف');
    res.json({ status: 'success', data: await tenderBoqExcelService.preview(req.file.buffer) });
  })
);

router.post(
  '/:tenderId/boq/excel/commit',
  authorize({ resource: 'project', action: 'edit' }),
  asyncHandler(async (req, res) => {
    const { rows } = req.body as { rows: Array<{ itemCode: string; descriptionAr: string; unit: string; quantity: number }> };
    const data = await contractTenderBoqService.importLines(cid(req as AuthRequest), req.params.tenderId, rows as never);
    res.json({ status: 'success', data });
  })
);

router.get('/:tenderId/integrity', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: await contractTenderIntegrityService.reconcile(cid(req as AuthRequest), req.params.tenderId) });
}));

router.get('/:tenderId', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: await contractTenderService.get(cid(req as AuthRequest), req.params.tenderId) });
}));

export default router;
