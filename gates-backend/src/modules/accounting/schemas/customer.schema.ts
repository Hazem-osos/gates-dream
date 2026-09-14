import { z } from 'zod';

export const createCustomerSchema = z.object({
  serial: z.string().optional(),
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  customerType: z.enum(['company', 'individual']).optional(),
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
  mainAccountId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  representativeId: z.string().uuid().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
  priceTier: z.enum(['RETAIL', 'SEMI_WHOLESALE', 'WHOLESALE', 'PROJECTS']).optional(),
  linkedSupplierId: z.string().uuid().optional().nullable(),
  sellingPrice: z.string().optional(),
  transactionType: z.string().optional(),
  warning: z.enum(['debtor', 'creditor']).optional().nullable(),
  estimatedBudget: z.number().nonnegative().optional().nullable(),
  creditLimit: z.number().nonnegative().optional().nullable(),
  /** Credit terms in days, used to derive Invoice.dueDate (H6). */
  paymentTermsDays: z.number().int().nonnegative().optional().nullable(),
  customerCategoryId: z.string().uuid().optional().nullable(),
  currencyCode: z.string().optional(),
  // Real Estate Investment fields
  contactDate: z.coerce.date().optional().nullable(),
  contactDateHijri: z.string().optional(),
  gender: z.enum(['ذكر', 'أنثى']).optional().nullable(),
  averagePrice: z.number().nonnegative().optional().nullable(),
  role: z.string().optional(),
  marketingChannelId: z.string().uuid().optional().nullable(),
  roomsCount: z.number().int().nonnegative().optional().nullable(),
  propertyArea: z.number().nonnegative().optional().nullable(),
  bathroomsCount: z.number().int().nonnegative().optional().nullable(),
  facade: z.string().optional(),
  transferTo: z.enum(['بائع', 'مدير مبيعات']).optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
  followUpDate: z.coerce.date().optional().nullable(),
  followUpDateHijri: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
  balance: z.number().optional(),
});

export const customerQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  customerType: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  accountId: z.string().uuid().optional(),
  customerCategoryId: z.string().uuid().optional(),
});

export const bulkCreateCustomersSchema = z.object({
  items: z.array(createCustomerSchema).min(1).max(100),
});

export const bulkUpdateCustomersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      data: updateCustomerSchema,
    })
  ).min(1).max(100),
});

export const bulkDeleteCustomersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
