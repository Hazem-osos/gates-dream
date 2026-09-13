import { z } from 'zod';
import { DOCUMENT_CATEGORIES, DOCUMENT_LINK_FIELDS } from '../types/document-attachment.types';

const linkFields = Object.fromEntries(
  DOCUMENT_LINK_FIELDS.map((field) => [field, z.string().min(1).optional()])
) as Record<(typeof DOCUMENT_LINK_FIELDS)[number], z.ZodOptional<z.ZodString>>;

export const attachmentLinksSchema = z.object(linkFields);

export const presignAttachmentSchema = attachmentLinksSchema.extend({
  originalFileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSize: z.coerce.number().int().positive(),
  fileCategory: z.enum(DOCUMENT_CATEGORIES).optional(),
  description: z.string().max(2000).optional(),
  entityType: z.string().min(1).max(40).optional(),
  entityId: z.string().min(1).optional(),
});

export const completeAttachmentSchema = z.object({
  attachmentId: z.string().uuid().optional(),
});

export const listAttachmentsQuerySchema = attachmentLinksSchema.extend({
  entityType: z.string().min(1).max(40).optional(),
  entityId: z.string().min(1).optional(),
});

export const attachmentIdParamSchema = z.object({
  id: z.string().uuid(),
});
