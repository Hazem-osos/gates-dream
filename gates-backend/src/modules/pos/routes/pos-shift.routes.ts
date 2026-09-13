import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import { posShiftService } from '../services/pos-shift.service';
import { closeShiftSchema, openShiftSchema } from '../schemas/pos.schema';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.post(
  '/open',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: openShiftSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posShiftService.openShift(ctx, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get(
  '/open',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const terminalId = req.query.terminalId as string | undefined;
    if (!companyId || !terminalId) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company ID and terminalId query required',
      });
    }
    const shift = await posShiftService.getOpenShiftForTerminal(companyId, terminalId);
    if (!shift) {
      return void res.json({ status: 'success', data: null });
    }
    const zReport = posShiftService.buildZReport(shift);
    return void res.json({ status: 'success', data: { shift, zReport } });
  }
);

router.get(
  '/:id',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const shift = await posShiftService.getShift(companyId, req.params.id);
    const zReport = posShiftService.buildZReport(shift);
    return void res.json({ status: 'success', data: { shift, zReport } });
  }
);

router.post(
  '/:id/close',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: closeShiftSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const result = await posShiftService.closeShift(
      ctx,
      req.params.id,
      req.body.closingCashDeclared
    );
    return void res.json({ status: 'success', data: result });
  }
);

router.post(
  '/:id/reopen',
  authorize({ resource: 'pos', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posShiftService.reopenShift(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
