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

export const approveDocumentsSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
  documentType: z.string().optional(), // 'journal-entry', 'invoice', etc.
  approveAll: z.boolean().default(false),
});

export const renumberOperationsSchema = z.object({
  operationType: z.enum(['journal-entry', 'invoice', 'treasury-receipt', 'treasury-payment']),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  startNumber: z.number().int().positive().default(1),
});

