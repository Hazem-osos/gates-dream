import { z } from 'zod';

export const businessVerticalSchema = z.enum([
  'TRADING',
  'CONTRACTING',
  'MANUFACTURING',
  'REAL_ESTATE',
  'SERVICES',
]);

export const bootstrapSchema = z.object({
  company: z.object({
    tradeNameAr: z.string().min(1).max(255),
    tradeNameEn: z.string().max(255).optional().nullable(),
    taxRegistrationNumber: z.string().max(100).optional().nullable(),
    commercialRegister: z.string().max(100).optional().nullable(),
    logoUrl: z.string().max(500_000).optional().nullable(),
  }),
  vertical: businessVerticalSchema,
  currencyCode: z.string().min(3).max(10).default('EGP'),
  branch: z.object({
    arabicName: z.string().min(1).max(255),
    warehouseName: z.string().min(1).max(255),
    safeName: z.string().min(1).max(255),
    safeCode: z.string().max(30).optional(),
    warehouseCode: z.string().max(30).optional(),
  }),
  onboardingStep: z.number().int().min(1).max(5).optional(),
});

export const importExcelSchema = z.object({
  entity: z.enum(['ITEMS', 'CUSTOMERS', 'SUPPLIERS']),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).min(1).max(500),
  openingStock: z.boolean().optional(),
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

export const launchChecklistSchema = z.object({
  createdFirstInvoice: z.boolean().optional(),
  addedFirstCustomer: z.boolean().optional(),
  createdFirstItem: z.boolean().optional(),
  recordedFirstReceipt: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

export type BootstrapInput = z.infer<typeof bootstrapSchema>;
