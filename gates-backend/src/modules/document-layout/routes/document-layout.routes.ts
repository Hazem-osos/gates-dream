import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { documentLayoutService, DOCUMENT_LAYOUT_DEFAULTS } from '../services/document-layout.service';
import {
  documentLayoutConfigUpsertSchema,
  documentLayoutQuerySchema,
  documentLayoutResolveQuerySchema,
  documentLayoutTypeParamSchema,
  normalizeDocumentLayoutType,
} from '../schemas/document-layout.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get('/defaults', authorize({ resource: 'document-layout', action: 'view' }), (_req, res: Response) => {
  return void res.json({ status: 'success', data: DOCUMENT_LAYOUT_DEFAULTS });
});

router.get(
  '/',
  authorize({ resource: 'document-layout', action: 'view' }),
  validate({ query: documentLayoutQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const query = req.query as unknown as { documentType?: string; branchId?: string };
      const data = await documentLayoutService.list(companyId, query);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to list document layout configs',
      });
    }
  }
);

router.get(
  '/resolve',
  authorize({ resource: 'document-layout', action: 'view' }),
  validate({ query: documentLayoutResolveQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const query = req.query as unknown as { documentType: string; branchId?: string };
      const data = await documentLayoutService.resolveEffective(
        companyId,
        query.documentType,
        query.branchId ?? req.branchId ?? null
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to resolve document layout config',
      });
    }
  }
);

router.get(
  '/by-type/:documentType',
  authorize({ resource: 'document-layout', action: 'view' }),
  validate({ params: documentLayoutTypeParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const documentType = normalizeDocumentLayoutType(req.params.documentType) ?? 'ALL';
      const data = await documentLayoutService.resolveEffective(
        companyId,
        documentType,
        req.branchId ?? null
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to fetch document layout config',
      });
    }
  }
);

router.put(
  '/:documentType',
  authorize({ resource: 'document-layout', action: 'edit' }),
  validate({ params: documentLayoutTypeParamSchema, body: documentLayoutConfigUpsertSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const documentType = normalizeDocumentLayoutType(req.params.documentType) ?? 'ALL';
      const data = await documentLayoutService.upsert(companyId, { ...req.body, documentType });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to save document layout config',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'document-layout', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const asType = normalizeDocumentLayoutType(req.params.id);
      const data = asType
        ? await documentLayoutService.resolveEffective(companyId, asType, req.branchId ?? null)
        : await documentLayoutService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to fetch document layout config',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'document-layout', action: 'edit' }),
  validate({ body: documentLayoutConfigUpsertSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');
      const { id: _ignored, ...body } = req.body as { id?: string };
      const data = await documentLayoutService.upsert(companyId, body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to save document layout config',
      });
    }
  }
);

router.put(
  '/',
  authorize({ resource: 'document-layout', action: 'edit' }),
  validate({ body: documentLayoutConfigUpsertSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const data = await documentLayoutService.upsert(companyId, req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to save document layout config',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'document-layout', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const data = await documentLayoutService.remove(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete document layout config',
      });
    }
  }
);

export default router;
