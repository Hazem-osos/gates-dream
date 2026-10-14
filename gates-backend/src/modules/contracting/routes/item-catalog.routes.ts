import { Router } from 'express';
import type { BOQItemUnit } from '@prisma/client';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { contractingItemCatalogService } from '../tender/contracting-item-catalog.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function cid(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

router.get('/', authorize({ resource: 'project', action: 'view' }), asyncHandler(async (req, res) => {
  const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
  res.json({
    status: 'success',
    data: await contractingItemCatalogService.list(cid(req as AuthRequest), kind),
  });
}));

router.post('/', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const body = req.body as {
    itemCode: string;
    descriptionAr: string;
    descriptionEn?: string;
    unit?: BOQItemUnit;
    kind?: string;
    groupName?: string;
    notes?: string;
  };
  const data = await contractingItemCatalogService.create(cid(req as AuthRequest), body);
  res.status(201).json({ status: 'success', data });
}));

router.patch('/:id', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  const body = req.body as {
    itemCode?: string;
    descriptionAr?: string;
    descriptionEn?: string | null;
    unit?: BOQItemUnit;
    kind?: string;
    groupName?: string | null;
    notes?: string | null;
    isActive?: boolean;
  };
  res.json({
    status: 'success',
    data: await contractingItemCatalogService.update(cid(req as AuthRequest), req.params.id, body),
  });
}));

router.delete('/:id', authorize({ resource: 'project', action: 'edit' }), asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: await contractingItemCatalogService.deactivate(cid(req as AuthRequest), req.params.id),
  });
}));

export default router;
