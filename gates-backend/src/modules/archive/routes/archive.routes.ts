import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { documentArchiveService } from '../services/document-archive.service';
import { ARCHIVE_ENTITY_TYPES } from '../types/archive-entity.types';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const uploadSchema = z.object({
  entityType: z.enum(ARCHIVE_ENTITY_TYPES as unknown as [string, ...string[]]),
  entityId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(1),
  branchId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

router.post(
  '/upload',
  authorize({ resource: 'archive', action: 'edit' }),
  validate({ body: uploadSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const body = req.body as z.infer<typeof uploadSchema>;
      let buffer: Buffer;
      try {
        buffer = Buffer.from(body.contentBase64, 'base64');
      } catch {
        throw new AppError(400, 'Invalid contentBase64');
      }
      if (buffer.length === 0) throw new AppError(400, 'Empty file content');

      const data = await documentArchiveService.upload({
        companyId,
        branchId: body.branchId ?? req.branchId,
        entityType: body.entityType as (typeof ARCHIVE_ENTITY_TYPES)[number],
        entityId: body.entityId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        buffer,
        uploadedById: req.user?.sub,
        description: body.description,
        tags: body.tags,
      });

      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Upload failed',
      });
    }
  }
);

router.get(
  '/:entityType/:entityId',
  authorize({ resource: 'archive', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const data = await documentArchiveService.listForEntity(
        companyId,
        req.params.entityType,
        req.params.entityId
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'List attachments failed',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'archive', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const data = await documentArchiveService.softDelete(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Delete attachment failed',
      });
    }
  }
);

export default router;
