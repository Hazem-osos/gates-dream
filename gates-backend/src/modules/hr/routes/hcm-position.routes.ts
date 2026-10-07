import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { hcmPositionService } from '../services/hcm/hcm-position.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get('/', authorize({ resource: 'employee', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await hcmPositionService.list(companyId, {
    departmentId: req.query.departmentId as string | undefined,
  });
  return void res.json({ status: 'success', data });
});

router.get('/:id', authorize({ resource: 'employee', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await hcmPositionService.getById(companyId, req.params.id);
  return void res.json({ status: 'success', data });
});

router.post('/', authorize({ resource: 'employee', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const data = await hcmPositionService.create(companyId, req.body);
  return void res.status(201).json({ status: 'success', data });
});

export default router;
