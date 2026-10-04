import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import { posCommercialService } from '../services/pos-commercial.service';
import { canDiscountPos, canOverridePosPrice } from '../services/pos-pricing.service';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

const lineSchema = z.object({
  itemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  taxPercent: z.number().nonnegative().optional(),
  lineOrder: z.number().int().positive(),
});

async function flagsOf(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId ?? '';
  const userId = req.user?.sub ?? '';
  const [trustPrice, trustDiscount] = await Promise.all([
    userId ? canOverridePosPrice(companyId, userId) : false,
    userId ? canDiscountPos(companyId, userId) : false,
  ]);
  return { trustPrice, trustDiscount, companyId, userId };
}

router.get('/quotes', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  return void res.json({ status: 'success', data: await posCommercialService.listQuotes(companyId) });
});

router.post(
  '/quotes',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({
    body: z.object({
      shiftId: z.string().uuid(),
      quoteName: z.string().min(1).max(80),
      expiresAt: z.string().min(1),
      customerId: z.string().uuid().optional(),
      notes: z.string().max(2000).optional(),
      couponCode: z.string().max(40).optional(),
      lines: z.array(lineSchema).min(1),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const flags = await flagsOf(req);
    const data = await posCommercialService.saveQuote(flags.companyId, req.body.shiftId, req.body, flags, flags.userId);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post('/quotes/:id/convert', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const flags = await flagsOf(req);
  const data = await posCommercialService.convertQuote(flags.companyId, req.params.id, String(req.body?.shiftId ?? ''), flags, flags.userId);
  return void res.status(201).json({ status: 'success', data });
});

router.post(
  '/exchange',
  authorize({ resource: 'pos', action: 'post' }),
  validate({
    body: z.object({
      shiftId: z.string().uuid(),
      originalOrderId: z.string().uuid(),
      returnLines: z.array(z.object({ originalLineId: z.string().uuid(), quantity: z.number().positive() })).min(1),
      saleLines: z.array(lineSchema).min(1),
      customerId: z.string().uuid().optional(),
      collectMethod: z.string().max(20).optional(),
      refundMethod: z.string().max(20).optional(),
      safeId: z.string().uuid().optional(),
      bankAccountId: z.string().uuid().optional(),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const flags = await flagsOf(req);
    const data = await posCommercialService.exchange(buildPosPostingContext(req), req.body, flags);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get('/coupons', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  return void res.json({ status: 'success', data: await posCommercialService.listCoupons(companyId) });
});

router.post(
  '/coupons',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({
    body: z.object({
      code: z.string().min(1).max(40),
      kind: z.enum(['PERCENT', 'AMOUNT']),
      percent: z.number().min(0).max(100).nullable().optional(),
      amount: z.number().nonnegative().nullable().optional(),
      minSpend: z.number().nonnegative().optional(),
      maxUses: z.number().int().positive().nullable().optional(),
      singleUsePerCustomer: z.boolean().optional(),
      customerId: z.string().uuid().nullable().optional(),
      validFrom: z.string(),
      validTo: z.string(),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const { companyId } = await flagsOf(req);
    const data = await posCommercialService.saveCoupon(companyId, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/gift-cards',
  authorize({ resource: 'pos', action: 'post' }),
  validate({
    body: z.object({
      amount: z.number().positive(),
      code: z.string().max(40).optional(),
      expiresAt: z.string().optional(),
      safeId: z.string().uuid(),
      shiftId: z.string().uuid(),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const data = await posCommercialService.issueGiftCard(buildPosPostingContext(req), req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/gift-cards/load',
  authorize({ resource: 'pos', action: 'post' }),
  validate({ body: z.object({ code: z.string().min(1), amount: z.number().positive(), safeId: z.string().uuid(), shiftId: z.string().uuid() }) }),
  async (req: AuthRequest, res: Response) => {
    const data = await posCommercialService.loadGiftCard(buildPosPostingContext(req), req.body);
    return void res.json({ status: 'success', data });
  }
);

router.get('/gift-cards/:code', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  return void res.json({ status: 'success', data: await posCommercialService.giftCardBalance(companyId, req.params.code) });
});

router.get('/wallets/:customerId', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  return void res.json({ status: 'success', data: await posCommercialService.wallet(companyId, req.params.customerId) });
});

router.get('/availability', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  return void res.json({ status: 'success', data: await posCommercialService.availability(companyId, String(req.query.itemId ?? '')) });
});

router.post(
  '/reservations/stock',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({
    body: z.object({
      warehouseId: z.string().min(1),
      itemId: z.string().min(1),
      quantity: z.number().positive(),
      reason: z.string().min(1).max(500),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const { companyId } = await flagsOf(req);
    const data = await posCommercialService.reserveElsewhere(companyId, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/reservations',
  authorize({ resource: 'pos', action: 'post' }),
  validate({
    body: z.object({
      shiftId: z.string().uuid(),
      amount: z.number().positive(),
      safeId: z.string().uuid(),
      customerId: z.string().uuid().optional(),
      notes: z.string().max(2000).optional(),
      lines: z.array(lineSchema).min(1),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const flags = await flagsOf(req);
    const data = await posCommercialService.createReservation(buildPosPostingContext(req), req.body, flags);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post('/reservations/:id/cancel', authorize({ resource: 'pos', action: 'void' }), async (req: AuthRequest, res: Response) => {
  const data = await posCommercialService.cancelReservation(buildPosPostingContext(req), req.params.id);
  return void res.json({ status: 'success', data });
});

router.post(
  '/no-sale',
  authorize({ resource: 'pos', action: 'no_sale' }),
  validate({ body: z.object({ terminalId: z.string().uuid(), shiftId: z.string().uuid().optional(), reason: z.string().min(1).max(191) }) }),
  async (req: AuthRequest, res: Response) => {
    const data = await posCommercialService.noSale(buildPosPostingContext(req), req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/terminals/:id/lock',
  authorize({ resource: 'pos', action: 'lock_terminal' }),
  validate({ body: z.object({ locked: z.boolean(), reason: z.string().max(191).optional() }) }),
  async (req: AuthRequest, res: Response) => {
    const data = await posCommercialService.setLock(buildPosPostingContext(req), req.params.id, req.body.locked, req.body.reason ?? '');
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/handover',
  authorize({ resource: 'pos', action: 'handover' }),
  validate({ body: z.object({ shiftId: z.string().uuid(), toUserId: z.string().min(1), reason: z.string().min(1).max(191) }) }),
  async (req: AuthRequest, res: Response) => {
    const data = await posCommercialService.handover(buildPosPostingContext(req), req.body);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/orders/:id/deliver',
  authorize({ resource: 'pos', action: 'print' }),
  validate({
    body: z.object({
      channel: z.enum(['EMAIL', 'WHATSAPP', 'SMS']),
      to: z.string().optional(),
      templateName: z.string().optional(),
      language: z.string().optional(),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const { companyId } = await flagsOf(req);
    const data = await posCommercialService.deliverReceipt(companyId, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

router.get('/orders/:id/receipt-link', authorize({ resource: 'pos', action: 'print' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  const token = await posCommercialService.ensureReceiptToken(companyId, req.params.id);
  return void res.json({ status: 'success', data: { url: `/api/v1/public/pos/receipts/${token}` } });
});

router.get('/offers/explain', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const { companyId } = await flagsOf(req);
  const data = await posCommercialService.explainOffer(
    companyId,
    String(req.query.itemId ?? ''),
    Number(req.query.quantity ?? 1),
    req.query.customerId ? String(req.query.customerId) : undefined
  );
  return void res.json({ status: 'success', data });
});

export default router;
