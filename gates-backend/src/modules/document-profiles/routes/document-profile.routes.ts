import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import type { AuthRequest } from '../../../shared/auth/types';
import { documentProfileService } from '../services/document-profile.service';
import {
  createDocumentProfileSchema,
  documentProfileQuerySchema,
  updateDocumentProfileSchema,
} from '../schemas/document-profile.schema';

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

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: documentProfileQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.list(companyId, {
        baseType: req.query.baseType as never,
        sidebarOnly: req.query.sidebarOnly as boolean | undefined,
        includeInactive: req.query.includeInactive as boolean | undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to list document profiles');
    }
  }
);

router.get(
  '/by-slug/:slug',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.getBySlug(companyId, req.params.slug);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to load document profile');
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return handleError(res, error, 'Failed to load document profile');
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'company-setting', action: 'edit' }),
  validate({ body: createDocumentProfileSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.create(companyId, req.body);
      return void res.status(201).json({ status: 'success', message: 'تم إنشاء النمط بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to create document profile');
    }
  }
);

router.patch(
  '/:id',
  authorize({ resource: 'company-setting', action: 'edit' }),
  validate({ body: updateDocumentProfileSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.update(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', message: 'تم تحديث النمط بنجاح', data });
    } catch (error) {
      return handleError(res, error, 'Failed to update document profile');
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'company-setting', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const data = await documentProfileService.deactivate(companyId, req.params.id);
      return void res.json({ status: 'success', message: 'تم إيقاف النمط', data });
    } catch (error) {
      return handleError(res, error, 'Failed to deactivate document profile');
    }
  }
);

export default router;
