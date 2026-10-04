import { Router, Response } from 'express';
import { createReadStream } from 'node:fs';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { getEsignAgentRelease, resolveInstallerPath } from '../services/esign-agent-release';
import { esignPairingService } from '../services/esign-pairing.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/latest',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  (_req: AuthRequest, res: Response) => {
    return void res.json({
      status: 'success',
      data: getEsignAgentRelease(),
    });
  }
);

router.get(
  '/download/windows',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  (_req: AuthRequest, res: Response) => {
    const release = getEsignAgentRelease();
    if (release.downloadUrl && /^https?:\/\//i.test(release.downloadUrl)) {
      return void res.redirect(302, release.downloadUrl);
    }
    const file = resolveInstallerPath();
    if (!file) {
      return void res.status(404).json({
        status: 'error',
        message: 'GatesESignSetup.exe is not configured. Set GATES_ESIGN_DOWNLOAD_URL or GATES_ESIGN_INSTALLER_PATH.',
      });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="GatesESignSetup.exe"');
    createReadStream(file).pipe(res);
  }
);

router.get(
  '/pairing/status',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const data = await esignPairingService.status(companyId, String(req.query.deviceId ?? ''));
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/pairing/start',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({
    body: z.object({ deviceId: z.string().min(8).optional() }),
  }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await esignPairingService.start(companyId, userId, req.body.deviceId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        code: e instanceof AppError && 'code' in e ? (e as { code?: string }).code : undefined,
        message: e instanceof Error ? e.message : 'Pairing start failed',
      });
    }
  }
);

router.post(
  '/pairing/complete',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({
    body: z.object({
      pairingSessionId: z.string().uuid(),
      deviceId: z.string().min(8),
      proof: z.string().min(16),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    const userId = req.user?.sub;
    if (!companyId || !userId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await esignPairingService.complete(companyId, userId, req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        code: e instanceof AppError && 'code' in e ? (e as { code?: string }).code : undefined,
        message: e instanceof Error ? e.message : 'Pairing complete failed',
      });
    }
  }
);

router.post(
  '/pairing/revoke',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({
    body: z.object({ deviceId: z.string().min(8) }),
  }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    const data = await esignPairingService.revoke(companyId, req.body.deviceId);
    return void res.json({ status: 'success', data });
  }
);

export default router;
