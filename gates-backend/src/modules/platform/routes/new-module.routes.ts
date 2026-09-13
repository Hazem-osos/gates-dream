import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { AuthRequest } from '../../../shared/auth/types';
import { newModuleService } from '../services/new-module.service';
import {
  createNewModuleSchema,
  otherModuleRightSchema,
  updateNewModuleSchema,
} from '../schemas/new-module.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

function handleError(res: Response, error: unknown, fallback: string) {
  const status = error instanceof AppError ? error.statusCode : 500;
  if (status >= 500) logger.error({ error }, fallback);
  return void res.status(status).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  });
}

router.get('/', authorize({ resource: 'new-module', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    const baseType = typeof req.query.baseType === 'string' ? req.query.baseType : undefined;
    const data = await newModuleService.list(companyId, baseType);
    return void res.json({ status: 'success', data });
  } catch (error) {
    return handleError(res, error, 'Failed to list new modules');
  }
});

router.get('/:id', authorize({ resource: 'new-module', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    const data = await newModuleService.getById(companyId, req.params.id);
    return void res.json({ status: 'success', data });
  } catch (error) {
    return handleError(res, error, 'Failed to load new module');
  }
});

router.post(
  '/',
  authorize({ resource: 'new-module', action: 'edit' }),
  validate({ body: createNewModuleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await newModuleService.create({ companyId, ...req.body });
      return void res.status(201).json({ status: 'success', message: 'تم تعريف الشاشة بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to create new module');
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'new-module', action: 'edit' }),
  validate({ body: updateNewModuleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await newModuleService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', message: 'تم تحديث الشاشة بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to update new module');
    }
  }
);

router.delete('/:id', authorize({ resource: 'new-module', action: 'delete' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    await newModuleService.remove(companyId, req.params.id);
    return void res.json({ status: 'success', message: 'تم حذف الشاشة بنجاح' });
  } catch (error) {
    return handleError(res, error, 'Failed to delete new module');
  }
});

// ---- OtherModulesRights (cross-module read grants) ----

router.get(
  '/other-module-rights/all',
  authorize({ resource: 'new-module', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await newModuleService.listOtherModuleRights(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to list other-module rights');
    }
  }
);

router.post(
  '/other-module-rights',
  authorize({ resource: 'new-module', action: 'edit' }),
  validate({ body: otherModuleRightSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const { sanadModule, readModule } = req.body as { sanadModule: string; readModule: string };
      const data = await newModuleService.grantOtherModuleRight(companyId, sanadModule, readModule);
      return void res.status(201).json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to grant other-module right');
    }
  }
);

router.delete(
  '/other-module-rights/:id',
  authorize({ resource: 'new-module', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      await newModuleService.revokeOtherModuleRight(companyId, req.params.id);
      return void res.json({ status: 'success' });
    } catch (error) {
      return handleError(res, error, 'Failed to revoke other-module right');
    }
  }
);

export default router;
