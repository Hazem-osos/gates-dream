import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { AuthRequest } from '../../../shared/auth/types';
import { companySettingService } from '../services/company-setting.service';
import {
  catalogCompanySettingsQuerySchema,
  listCompanySettingsQuerySchema,
  setCompanySettingSchema,
} from '../schemas/company-setting.schema';

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

/**
 * GET /api/v1/company-settings/catalog
 * Must be registered before `/:name` so "catalog" is not treated as a key.
 */
router.get(
  '/catalog',
  authorize({ resource: 'company-setting', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const query = catalogCompanySettingsQuerySchema.parse(req.query);
      const data = await companySettingService.getCatalogAdmin(companyId, {
        branchId: query.branchId,
        moduleCode: query.moduleCode,
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to load company settings catalog');
    }
  }
);

/** GET /api/v1/company-settings?prefix=&branchId= — admin listing for a settings UI. */
router.get('/', authorize({ resource: 'company-setting', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    const query = listCompanySettingsQuerySchema.parse(req.query);
    const data = await companySettingService.listEntries(companyId, {
      prefix: query.prefix,
      branchId: query.branchId,
    });
    return void res.json({ status: 'success', data });
  } catch (error) {
    return handleError(res, error, 'Failed to list company settings');
  }
});

/** GET /api/v1/company-settings/:name — value + legacy-exact default when absent. */
router.get('/:name', authorize({ resource: 'company-setting', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const value = await companySettingService.getEntry(companyId, req.params.name, { branchId });
    const legacyDefault = companySettingService.getLegacyDefault(req.params.name);
    return void res.json({
      status: 'success',
      data: { name: req.params.name, value, legacyDefault, isDynamicDefault: companySettingService.isDynamicDefaultKey(req.params.name) },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to load company setting');
  }
});

/** PUT /api/v1/company-settings/:name — write/admin API. */
router.put(
  '/:name',
  authorize({ resource: 'company-setting', action: 'edit' }),
  validate({ body: setCompanySettingSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const { value, branchId } = req.body as { value: string; branchId?: string | null };
      const data = await companySettingService.setEntry(companyId, req.params.name, value, {
        branchId,
      });
      return void res.json({ status: 'success', message: 'تم حفظ الإعداد بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to save company setting');
    }
  }
);

/** DELETE /api/v1/company-settings/:name — remove an override (falls back to legacy default). */
router.delete('/:name', authorize({ resource: 'company-setting', action: 'delete' }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = requireCompanyId(req);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    await companySettingService.deleteEntry(companyId, req.params.name, { branchId });
    return void res.json({ status: 'success' });
  } catch (error) {
    return handleError(res, error, 'Failed to delete company setting');
  }
});

export default router;
