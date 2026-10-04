import { z } from 'zod';

export const databaseBackupSchema = z.object({
  name: z.string().min(1, 'Backup name is required'),
  path: z.string().optional(),
  includeData: z.boolean().default(true),
  includeSchema: z.boolean().default(true),
});

export const databaseRestoreSchema = z.object({
  backupFile: z.string().min(1, 'Backup file path is required'),
  restoreData: z.boolean().default(true),
  restoreSchema: z.boolean().default(true),
});

export const exportDataSchema = z.object({
  tables: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv', 'sql']).default('json'),
  path: z.string().optional(),
});

export const importDataSchema = z.object({
  file: z.string().min(1, 'Import file path is required'),
  format: z.enum(['json', 'csv', 'sql']).default('json'),
  tables: z.array(z.string()).optional(),
  overwrite: z.boolean().default(false),
});

const approveDocumentTypeSchema = z.enum(['journal-entry', 'invoice']);

export const approveDocumentsSchema = z
  .object({
    documentIds: z.array(z.string().uuid()).default([]),
    documentType: approveDocumentTypeSchema.optional(),
    approveAll: z.boolean().default(false),
  })
  .superRefine((body, ctx) => {
    if (body.approveAll) {
      if (!body.documentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'documentType is required when approveAll is true',
          path: ['documentType'],
        });
      }
      return;
    }
    if (body.documentIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one documentId is required when approveAll is false',
        path: ['documentIds'],
      });
    }
  });

export const renumberOperationsSchema = z.object({
  operationType: z.enum(['journal-entry', 'invoice', 'treasury-receipt', 'treasury-payment']),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startNumber: z.number().int().positive().default(1),
});

