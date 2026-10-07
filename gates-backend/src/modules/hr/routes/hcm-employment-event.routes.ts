import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { hcmEmploymentEventService } from '../services/hcm/hcm-event.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/employment/:employmentId',
  authorize({ resource: 'employment', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await hcmEmploymentEventService.listForEmployment(companyId, req.params.employmentId);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/',
  authorize({ resource: 'employment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await hcmEmploymentEventService.createDraft(companyId, {
      ...req.body,
      effectiveDate: new Date(req.body.effectiveDate),
      requestedBy: req.user?.sub,
    });
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/:id/submit',
  authorize({ resource: 'employment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await hcmEmploymentEventService.submit(companyId, req.params.id, req.user?.sub ?? 'system');
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/approve',
  authorize({ resource: 'employment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await hcmEmploymentEventService.approve(companyId, req.params.id, req.user?.sub ?? 'system');
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/reject',
  authorize({ resource: 'employment', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const data = await hcmEmploymentEventService.reject(
      companyId,
      req.params.id,
      req.user?.sub ?? 'system',
      req.body?.reason ?? 'Rejected'
    );
    return void res.json({ status: 'success', data });
  }
);

export default router;
