import { z } from 'zod';

export const delegateRoleSchema = z.enum(['DELEGATE', 'DISTRIBUTOR', 'DRIVER']);

export const createDelegateSchema = z.object({
  serial: z.string().optional(),
  code: z.string().optional(),
  role: delegateRoleSchema.optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  nationality: z.string().optional(),
  barcode: z.string().optional(),
  phone1: z.string().optional(),
  phone2: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email('صيغة الإيميل غير صحيحة').optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
  country: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  poBox: z.string().optional(),
  address: z.string().optional(),
  commissionPercentage: z.number().min(0).max(100).optional().nullable(),
  commissionPolicyId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  salesCommissionsId: z.string().uuid().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
});

export const updateDelegateSchema = createDelegateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const delegateQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  role: delegateRoleSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateDelegateInput = z.infer<typeof createDelegateSchema>;
export type UpdateDelegateInput = z.infer<typeof updateDelegateSchema>;
export type DelegateQueryInput = z.infer<typeof delegateQuerySchema>;
