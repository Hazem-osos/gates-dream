import { z } from 'zod';

export const documentEntityTypeSchema = z.enum(['INVOICE', 'JOURNAL_ENTRY', 'STOCK_MOVEMENT']);

export const approvalEntityQuerySchema = z.object({
  entityType: documentEntityTypeSchema,
  entityId: z.string().uuid(),
});

export const approvalActionSchema = z.object({
  entityType: documentEntityTypeSchema.refine((t) => t !== 'STOCK_MOVEMENT', {
    message: 'Use INVOICE or JOURNAL_ENTRY',
  }),
  entityId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const approvalRejectSchema = approvalActionSchema.extend({
  reason: z.string().min(1).max(2000),
});

export const documentAuditQuerySchema = z.object({
  entityType: documentEntityTypeSchema,
  entityId: z.string().uuid(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
