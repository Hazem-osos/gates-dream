import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  // C12 fix: this used to be a generic-row-CRUD `INSERT | UPDATE | DELETE`
  // enum, matching the never-written `AuditLog` model it backed. The
  // service now reads from `ActivityLog`, whose `document-audit` entries
  // use business-level lifecycle actions instead (`CREATED`, `POSTED`,
  // `REVERSED`, etc. — see `DocumentAuditAction`), so this is a free-form
  // string rather than a fixed enum.
  tableName: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  rowId: z.string().optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

