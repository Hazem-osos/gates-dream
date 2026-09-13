import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildTreasuryPostingContext } from '../services/treasury-posting-context';
import { chequeLifecycleService } from '../services/cheque-lifecycle.service';
import { getChequeById, getChequeStats, listCheques } from '../controllers/cheque.controller';
import {
  chequeStatsQuerySchema,
  clearInwardChequeSchema,
  createInwardChequeSchema,
  createOutwardChequeSchema,
  endorseInwardChequeSchema,
  listChequesQuerySchema,
} from '../schemas/treasury.schema';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.get(
  '/',
  authorize({ resource: 'treasury', action: 'view' }),
  validate({ query: listChequesQuerySchema }),
  asyncHandler(listCheques)
);

router.get(
  '/stats',
  authorize({ resource: 'treasury', action: 'view' }),
  validate({ query: chequeStatsQuerySchema }),
  asyncHandler(getChequeStats)
);

router.get(
  '/:id',
  authorize({ resource: 'treasury', action: 'view' }),
  asyncHandler(getChequeById)
);

router.post(
  '/inward',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: createInwardChequeSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.createInwardCheque(ctx, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/send-to-bank',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.sendInwardToBank(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/unsend-to-bank',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.unsendInwardToBank(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/clear',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: clearInwardChequeSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.clearInwardCheque(
      ctx,
      req.params.id,
      req.body.bankAccountId
    );
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/unclear',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.unclearInwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/bounce',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.bounceInwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/unbounce',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.unbounceInwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

/** L2 fix (Item 41): endorse (تظهير) an inward cheque to a supplier instead of depositing it. */
router.post(
  '/inward/:id/endorse',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: endorseInwardChequeSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.endorseInwardCheque(
      ctx,
      req.params.id,
      req.body.supplierId,
      req.body.notes
    );
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/inward/:id/unendorse',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.unendorseInwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/outward',
  authorize({ resource: 'treasury', action: 'edit' }),
  validate({ body: createOutwardChequeSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.issueOutwardCheque(ctx, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/outward/:id/clear',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.clearOutwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/outward/:id/unclear',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.unclearOutwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/outward/:id/cancel',
  authorize({ resource: 'treasury', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await chequeLifecycleService.cancelOutwardCheque(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
