import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import { posShiftService } from '../services/pos-shift.service';
import { closeShiftSchema, openShiftSchema, posCashMovementSchema } from '../schemas/pos.schema';
import { posCashMovementService } from '../services/pos-cash-movement.service';
import { posAccountResolverService } from '../services/pos-account-resolver.service';
import { searchPosPostingAccounts } from '../services/pos-account-lookup.service';
import { userPermissionsService } from '../../users/services/user-permissions.service';

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
  '/accounts',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    const data = await searchPosPostingAccounts(
      companyId,
      String(req.query.q ?? ''),
      Number(req.query.limit ?? 20)
    );
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/readiness',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await posAccountResolverService.varianceAccountReadiness(companyId);
    return void res.json({ status: 'success', data });
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

router.get(
  '/:id/reconciliation',
  authorize({ resource: 'pos', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    const data = await posShiftService.reconciliation(companyId, req.params.id);
    const { getPosSettings } = await import('../services/pos-workspace.service');
    const settings = await getPosSettings(companyId);
    const canSeeExpected = req.user?.sub
      ? await userPermissionsService.checkUserPermission(companyId, req.user.sub, 'pos', 'approve')
      : false;
    if (settings.blindClose && !canSeeExpected && data.shift.status === 'OPEN') {
      return void res.json({
        status: 'success',
        data: { ...data, blind: true, equation: { ...data.equation, expectedCash: null } },
      });
    }
    return void res.json({ status: 'success', data: { ...data, blind: false } });
  }
);

router.post(
  '/:id/cash-movements',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: posCashMovementSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posCashMovementService.record(ctx, { shiftId: req.params.id, ...req.body });
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/:id/close',
  authorize({ resource: 'pos', action: 'edit' }),
  validate({ body: closeShiftSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const approverIsSupervisor = ctx.userId
      ? await userPermissionsService.checkUserPermission(ctx.companyId, ctx.userId, 'pos', 'approve')
      : false;
    const result = await posShiftService.closeShift(
      ctx,
      req.params.id,
      req.body.closingCashDeclared ?? 0,
      { approverIsSupervisor, denominations: req.body.denominations }
    );
    return void res.json({ status: 'success', data: result });
  }
);

router.post(
  '/:id/reopen',
  authorize({ resource: 'pos', action: 'reopen_shift' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildPosPostingContext(req);
    const data = await posShiftService.reopenShift(ctx, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
