import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { contractingCostElementCatalogService } from '../tender/contracting-cost-element-catalog.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function cid(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

router.get('/', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  res.json({
    status: 'success',
    data: await contractingCostElementCatalogService.list(cid(req as AuthRequest), type),
  });
}));

router.post('/', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const data = await contractingCostElementCatalogService.create(cid(req as AuthRequest), req.body);
  res.status(201).json({ status: 'success', data });
}));

router.patch('/:id', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractingCostElementCatalogService.update(
      cid(req as AuthRequest),
      req.params.id,
      req.body
    ),
  });
}));

router.delete('/:id', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractingCostElementCatalogService.deactivate(cid(req as AuthRequest), req.params.id),
  });
}));

export default router;
