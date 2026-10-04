import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import { posOrderPostingService } from '../services/pos-order-posting.service';
import { posService } from '../services/pos.service';
import { canDiscountPos, canOverridePosPrice } from '../services/pos-pricing.service';
import { createPosOrderSchema, postPosOrderSchema, quotePosOrderSchema, posReturnSchema } from '../schemas/pos.schema';
import { cancelUnsubmittedReceipt, fiscalSnapshot, issuePostedPosReceipt } from '../../ereceipt/issue.service';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function companyIdOf(req: AuthRequest) {
  return req.companyId ?? req.tenantId;
}

async function postedPayload(companyId: string, orderId: string, posted: object, issue: boolean) {
  const fiscal = issue
    ? await issuePostedPosReceipt(companyId, orderId)
    : await fiscalSnapshot(companyId, orderId);
  const receipt = await posOrderPostingService.receipt(companyId, orderId);
  return {
    ...posted,
    fiscal,
    receipt: {
      ...receipt,
      fiscal,
      qrPayload: fiscal?.qrUrl ?? null,
      etaUuid: fiscal?.uuid ?? null,
      etaReceiptNumber: fiscal?.receiptNumber ?? null,
      etaStatusLabel: fiscal?.labelAr ?? null,
    },
  };
}

router.get(
  '/',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const limit = Number(req.query.limit ?? 50);
    const result = await posService.listPostedPosOrders(companyId, Number.isFinite(limit) ? limit : 50);
    return void res.json({
      status: 'success',
      data: result.rows,
      summary: result.summary,
      historicalLimitation: result.historicalLimitation,
    });
  }
);

router.get(
  '/held',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    const shiftId = String(req.query.shiftId ?? '');
    if (!companyId || !shiftId) {
      return void res.status(400).json({ status: 'error', message: 'Company and shiftId are required' });
    }
    const data = await posOrderPostingService.listHeld(companyId, shiftId);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/quote',
  authorize({ resource: 'pos', action: 'view' }),
  validate({ body: quotePosOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const userId = req.user?.sub ?? '';
    const [trustPrice, trustDiscount] = await Promise.all([
      userId ? canOverridePosPrice(companyId, userId) : false,
      userId ? canDiscountPos(companyId, userId) : false,
    ]);
    const data = await posOrderPostingService.quote(
      companyId,
      {
        orderNumber: 'QUOTE',
        lines: req.body.lines,
        customerId: req.body.customerId,
        headerDiscountPercent: req.body.headerDiscountPercent,
        couponCode: req.body.couponCode,
      },
      // Preview: ignore client price/discount the user is not allowed to set (no 403 toast spam).
      { trustPrice, trustDiscount, rejectUnauthorized: false, forgivingCoupon: true }
    );
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/lookup',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    const number = String(req.query.number ?? '').trim();
    if (!companyId || !number) {
      return void res.status(400).json({ status: 'error', message: 'Company and receipt number are required' });
    }
    const data = await posOrderPostingService.findPostedSale(companyId, number);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/returns',
  authorize({ resource: 'pos', action: 'post' }),
  validate({ body: posReturnSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const draft = await posOrderPostingService.createReturn(ctx, req.body);
    const net = Number(draft?.netAmount ?? 0);
    const payments = req.body.payments.length === 1
      ? [{ ...req.body.payments[0], amount: net }]
      : req.body.payments;
    try {
      const data = await posOrderPostingService.postOrder(ctx, draft!.id, payments, {
        approvalId: req.body.approvalId,
      });
      const payload = await postedPayload(ctx.companyId, draft!.id, data, true);
      return void res.status(201).json({ status: 'success', data: payload });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        return void res.status(403).json({
          status: 'error',
          message: error.message,
          data: { id: draft!.id, status: 'DRAFT' },
        });
      }
      throw error;
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createPosOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const userId = req.user?.sub ?? '';
    const [trustPrice, trustDiscount] = await Promise.all([
      userId ? canOverridePosPrice(companyId, userId) : false,
      userId ? canDiscountPos(companyId, userId) : false,
    ]);
    const { shiftId, hold, ...body } = req.body;
    const deferred = body.cashAmount == null && body.cardAmount == null && body.creditAmount == null;
    const data = await posOrderPostingService.createOrder(companyId, shiftId, body, {
      forceServerPricing: true,
      trustPrice,
      trustDiscount,
      rejectUnauthorized: true,
      paymentsDeferred: deferred,
      hold: Boolean(hold),
      userId,
    });
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get(
  '/:id/receipt',
  authorize({ resource: 'pos', action: 'reprint' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posOrderPostingService.reprint(companyId, req.params.id, req.user?.sub ?? '');
    const fiscal = await fiscalSnapshot(companyId, req.params.id);
    return void res.json({ status: 'success', data: { ...data, fiscal, qrPayload: fiscal?.qrUrl ?? null, etaUuid: fiscal?.uuid ?? null, etaReceiptNumber: fiscal?.receiptNumber ?? null, etaStatusLabel: fiscal?.labelAr ?? null } });
  }
);

router.post(
  '/:id/void',
  authorize({ resource: 'pos', action: 'void' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posOrderPostingService.voidOrder(ctx, req.params.id, String(req.body?.reason ?? ''));
    await cancelUnsubmittedReceipt(ctx.companyId, data.id);
    const receipt = await posOrderPostingService.receipt(ctx.companyId, data.id);
    const fiscal = await fiscalSnapshot(ctx.companyId, data.id);
    return void res.json({ status: 'success', data: { ...data, receipt: { ...receipt, fiscal }, fiscal } });
  }
);

router.post(
  '/sync',
  authorize({ resource: 'pos', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const userId = req.user?.sub ?? '';
    const [trustPrice, trustDiscount] = await Promise.all([
      userId ? canOverridePosPrice(companyId, userId) : false,
      userId ? canDiscountPos(companyId, userId) : false,
    ]);
    const draft = await posOrderPostingService.createOrder(companyId, req.body.shiftId, req.body, {
      forceServerPricing: true,
      paymentsDeferred: true,
      trustPrice,
      trustDiscount,
      rejectUnauthorized: true,
      userId,
    });
    if (draft?.status === 'POSTED' || draft?.status === 'VOIDED') {
      return void res.json({ status: 'success', data: draft });
    }
    const ctx = buildPosPostingContext(req);
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, req.body.payments);
    const payload = await postedPayload(ctx.companyId, draft!.id, posted, true);
    return void res.json({ status: 'success', data: payload });
  }
);

router.post(
  '/:id/hold',
  authorize({ resource: 'pos', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posOrderPostingService.holdOrder(companyId, req.params.id, req.user?.sub);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/resume',
  authorize({ resource: 'pos', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await posOrderPostingService.resumeHeld(companyId, req.params.id, req.user?.sub);
    return void res.json({ status: 'success', data });
  }
);

router.put(
  '/:id',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: createPosOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const userId = req.user?.sub ?? '';
    const [trustPrice, trustDiscount] = await Promise.all([
      userId ? canOverridePosPrice(companyId, userId) : false,
      userId ? canDiscountPos(companyId, userId) : false,
    ]);
    const data = await posOrderPostingService.updateDraft(companyId, req.params.id, req.body, {
      hold: Boolean(req.body.hold),
      userId,
      trustPrice,
      trustDiscount,
      rejectUnauthorized: true,
    });
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/post',
  authorize({ resource: 'pos', action: 'post' }),
  validate({ body: postPosOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posOrderPostingService.postOrder(ctx, req.params.id, req.body.payments, {
      approvalId: req.body.approvalId,
    });
    const payload = data?.id ? await postedPayload(ctx.companyId, data.id, data, true) : data;
    return void res.json({ status: 'success', data: payload });
  }
);

router.post(
  '/:id/unpost',
  authorize({ resource: 'pos', action: 'unpost' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posOrderPostingService.unpostOrder(ctx, req.params.id);
    await cancelUnsubmittedReceipt(ctx.companyId, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
