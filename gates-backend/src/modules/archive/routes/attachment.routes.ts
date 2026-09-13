import { Router } from 'express';
import express from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams, validateQuery } from '../../../shared/middleware/validate';
import { uploadAttachmentMemory } from '../middleware/attachment-upload.middleware';
import {
  attachmentIdParamSchema,
  listAttachmentsQuerySchema,
  presignAttachmentSchema,
} from '../schemas/document-attachment.validation';
import { documentAttachmentService } from '../services/document-attachment.service';
import type { DocumentCategory } from '@prisma/client';
import { DOCUMENT_LINK_FIELDS, MAX_CAD_ATTACHMENT_BYTES } from '../types/document-attachment.types';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

function requireUserId(req: AuthRequest): string {
  const userId = req.user?.sub;
  if (!userId) throw new AppError(401, 'Authentication required');
  return userId;
}

function linksFrom(body: Record<string, unknown>) {
  const links: Record<string, string> = {};
  for (const field of DOCUMENT_LINK_FIELDS) {
    const value = body[field];
    if (typeof value === 'string' && value.trim()) links[field] = value.trim();
  }
  return links;
}

router.post(
  '/presign',
  authorize({ resource: 'archive', action: 'edit' }),
  validateBody(presignAttachmentSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as {
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      fileCategory?: DocumentCategory;
      description?: string;
      entityType?: string;
      entityId?: string;
    } & Record<string, string | undefined>;
    const data = await documentAttachmentService.requestPresignedUpload({
      companyId: requireCompanyId(auth),
      userId: requireUserId(auth),
      branchId: auth.branchId,
      originalFileName: body.originalFileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      fileCategory: body.fileCategory,
      description: body.description,
      entityType: body.entityType,
      entityId: body.entityId,
      ...linksFrom(body),
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/:id/complete',
  authorize({ resource: 'archive', action: 'edit' }),
  validateParams(attachmentIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await documentAttachmentService.completeUpload(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/upload',
  authorize({ resource: 'archive', action: 'edit' }),
  uploadAttachmentMemory,
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const file = req.file;
    if (!file) throw new AppError(400, 'لم يتم رفع ملف');
    const body = req.body as Record<string, string | undefined>;
    const data = await documentAttachmentService.uploadDirect({
      companyId: requireCompanyId(auth),
      userId: requireUserId(auth),
      branchId: auth.branchId,
      originalFileName: file.originalname,
      mimeType: file.mimetype || body.mimeType || 'application/octet-stream',
      fileSize: file.size,
      fileCategory: (body.fileCategory as DocumentCategory | undefined) ?? 'GENERAL',
      description: body.description,
      entityType: body.entityType,
      entityId: body.entityId,
      buffer: file.buffer,
      ...linksFrom(body),
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.put(
  '/:id/bytes',
  authorize({ resource: 'archive', action: 'edit' }),
  validateParams(attachmentIdParamSchema),
  express.raw({ type: '*/*', limit: MAX_CAD_ATTACHMENT_BYTES }),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const token = String(req.header('x-upload-token') ?? req.header('X-Upload-Token') ?? '');
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    const data = await documentAttachmentService.receiveLocalBytes({
      companyId: requireCompanyId(auth),
      attachmentId: req.params.id,
      token,
      buffer,
      mimeType: req.header('content-type') ?? undefined,
    });
    res.json({ status: 'success', data });
  })
);

router.get(
  '/',
  authorize({ resource: 'archive', action: 'view' }),
  validateQuery(listAttachmentsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const data = await documentAttachmentService.list(requireCompanyId(req as AuthRequest), {
      entityType: query.entityType,
      entityId: query.entityId,
      ...linksFrom(query),
    });
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/download',
  authorize({ resource: 'archive', action: 'view' }),
  validateParams(attachmentIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await documentAttachmentService.getDownloadGrant(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/stream',
  authorize({ resource: 'archive', action: 'view' }),
  validateParams(attachmentIdParamSchema),
  asyncHandler(async (req, res) => {
    const { row, body, contentType, contentLength } = await documentAttachmentService.streamForCompany(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.setHeader('Content-Type', contentType || row.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(row.originalFileName || row.fileName)}"`
    );
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
      res.end(body);
      return;
    }
    (body as NodeJS.ReadableStream).pipe(res);
  })
);

router.patch(
  '/:id/archive',
  authorize({ resource: 'archive', action: 'edit' }),
  validateParams(attachmentIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await documentAttachmentService.archive(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.delete(
  '/:id',
  authorize({ resource: 'archive', action: 'delete' }),
  validateParams(attachmentIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await documentAttachmentService.softDelete(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

export default router;
