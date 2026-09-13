import { z } from 'zod';

export const createSupplierSchema = z.object({
  serial: z.string().optional(),
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  supplierType: z.enum(['company', 'individual']).optional(),
  how: z.enum(['local', 'export', 'exempt']).optional(),
  nationality: z.string().optional(),
  taxData: z.boolean().optional(),
  taxAuthority: z.string().optional(),
  taxAuthorityName: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  poBox: z.string().optional(),
  barcode: z.string().optional(),
  fileNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  financier: z.string().optional(),
  discountType: z.string().optional(),
  mainAccountId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  linkedCustomerId: z.string().uuid().optional().nullable(),
  transactionType: z.string().optional(),
  warning: z.enum(['debtor', 'creditor']).optional().nullable(),
  estimatedBudget: z.number().nonnegative().optional().nullable(),
  /** Credit terms in days, used to derive Invoice.dueDate (H6). */
  paymentTermsDays: z.number().int().nonnegative().optional().nullable(),
  currencyCode: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
  balance: z.number().optional(),
});

export const supplierQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  supplierType: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;
