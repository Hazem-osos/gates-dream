import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildPosPostingContext } from '../services/pos-posting-context';
import {
  collectPosCredit,
  decidePosApproval,
  getPosSettings,
  listOpenPosSessions,
  listPosApprovals,
  listPosAudit,
  listPosShiftCloses,
  posCreditWorkspace,
  requestPosApproval,
  savePosSettings,
} from '../services/pos-workspace.service';
import prisma from '../../../shared/database/prisma';

const router = Router();
router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

function companyIdOf(req: AuthRequest) {
  return req.companyId ?? req.tenantId;
}

router.get('/settings', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  return void res.json({ status: 'success', data: await getPosSettings(companyId) });
});

router.put('/settings', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  return void res.json({ status: 'success', data: await savePosSettings(companyId, req.body) });
});

router.get('/sessions', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  return void res.json({ status: 'success', data: await listOpenPosSessions(companyId) });
});

router.get('/approvals', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  return void res.json({ status: 'success', data: await listPosApprovals(companyId, status) });
});

router.post('/approvals', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await requestPosApproval(companyId, { ...req.body, requesterId: req.user?.sub ?? '' });
  return void res.status(201).json({ status: 'success', data });
});

router.post('/approvals/:id/decide', authorize({ resource: 'pos', action: 'approve' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await decidePosApproval(companyId, req.params.id, req.user?.sub ?? '', Boolean(req.body?.accept));
  return void res.json({ status: 'success', data });
});

router.get('/closes', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  return void res.json({ status: 'success', data: await listPosShiftCloses(companyId) });
});

router.get('/audit', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await listPosAudit(companyId, {
    userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
    terminalId: typeof req.query.terminalId === 'string' ? req.query.terminalId : undefined,
    shiftId: typeof req.query.shiftId === 'string' ? req.query.shiftId : undefined,
    documentId: typeof req.query.documentId === 'string' ? req.query.documentId : undefined,
    from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
    to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/credit/:customerId', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  return void res.json({ status: 'success', data: await posCreditWorkspace(companyId, req.params.customerId) });
});

router.post('/credit/collect', authorize({ resource: 'pos', action: 'post' }), async (req: AuthRequest, res: Response) => {
  const ctx = buildPosPostingContext(req);
  const data = await collectPosCredit(ctx, req.body);
  return void res.status(201).json({ status: 'success', data });
});

router.get('/barcode-rules', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await prisma.posBarcodeRule.findMany({ where: { companyId } });
  return void res.json({ status: 'success', data });
});

router.post('/barcode-rules', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await prisma.posBarcodeRule.create({ data: { companyId, ...req.body } });
  return void res.status(201).json({ status: 'success', data });
});

router.get('/templates', authorize({ resource: 'pos', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await prisma.posShiftTemplate.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  return void res.json({ status: 'success', data });
});

router.post('/templates', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const data = await prisma.posShiftTemplate.create({ data: { companyId, name: String(req.body?.name ?? '') } });
  return void res.status(201).json({ status: 'success', data });
});

router.put('/barcode-rules/:id', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const existing = await prisma.posBarcodeRule.findFirst({ where: { id: req.params.id, companyId } });
  if (!existing) return void res.status(404).json({ status: 'error', message: 'Barcode rule not found' });
  const data = await prisma.posBarcodeRule.update({ where: { id: existing.id }, data: { isActive: req.body?.isActive } });
  return void res.json({ status: 'success', data });
});

router.put('/templates/:id', authorize({ resource: 'pos', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = companyIdOf(req);
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  const existing = await prisma.posShiftTemplate.findFirst({ where: { id: req.params.id, companyId } });
  if (!existing) return void res.status(404).json({ status: 'error', message: 'Shift template not found' });
  const data = await prisma.posShiftTemplate.update({
    where: { id: existing.id },
    data: { isActive: req.body?.isActive, name: req.body?.name ? String(req.body.name) : undefined },
  });
  return void res.json({ status: 'success', data });
});

export default router;
