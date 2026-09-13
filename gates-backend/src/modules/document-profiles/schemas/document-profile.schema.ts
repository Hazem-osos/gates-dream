import { z } from 'zod';

export const documentBaseTypeSchema = z.enum([
  'SALES_INVOICE',
  'PURCHASE_INVOICE',
  'PAYMENT_VOUCHER',
  'RECEIPT_VOUCHER',
  'STOCK_ISSUE',
  'STOCK_RECEIPT',
  'SALES_RETURN',
  'PURCHASE_RETURN',
]);

export const documentProfileColumnKeySchema = z.enum([
  'colorAndSize',
  'batchAndExpiry',
  'withholdingTax',
  'costCenter',
  'serialsAndNotes',
]);

const slugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case');

export const createDocumentProfileSchema = z.object({
  slug: slugSchema,
  nameAr: z.string().trim().min(1, 'الاسم مطلوب').max(191),
  nameEn: z.string().trim().max(191).optional().nullable(),
  baseType: documentBaseTypeSchema,
  prefix: z.string().trim().max(32).optional().nullable(),
  nextNumber: z.number().int().min(1).optional(),
  defaultWarehouseId: z.string().uuid().optional().nullable(),
  lockWarehouse: z.boolean().optional(),
  defaultTreasuryId: z.string().uuid().optional().nullable(),
  lockTreasury: z.boolean().optional(),
  defaultCostCenterId: z.string().uuid().optional().nullable(),
  lockCostCenter: z.boolean().optional(),
  visibleColumns: z.array(documentProfileColumnKeySchema).optional().default([]),
  showInSidebar: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateDocumentProfileSchema = createDocumentProfileSchema.partial();

export const documentProfileQuerySchema = z.object({
  baseType: documentBaseTypeSchema.optional(),
  sidebarOnly: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  includeInactive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type CreateDocumentProfileInput = z.infer<typeof createDocumentProfileSchema>;
export type UpdateDocumentProfileInput = z.infer<typeof updateDocumentProfileSchema>;
