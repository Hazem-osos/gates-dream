import { z } from 'zod';

export const customerContractGroupSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  groupNumber: z.string().optional().nullable(),
  groupName: z.string().optional().nullable(),
  days: z.number().int().nonnegative().optional().nullable(),
});

export const createCustomerContractSchema = z.object({
  code: z.string().optional().nullable(),
  customerId: z.string().uuid('Invalid customer ID'),
  operationsCenterId: z.string().optional().nullable(),
  contractType: z.enum(['نقدي', 'آجل', 'جزء نقدي وجزء آجل', 'حسب الصنف']).optional().nullable(),
  cashPercentage: z.number().nonnegative().max(100).optional().nullable(),
  creditPercentage: z.number().nonnegative().max(100).optional().nullable(),
  daysCount: z.number().int().nonnegative().optional().nullable(),
  groups: z.array(customerContractGroupSchema).optional().default([]),
});

export const updateCustomerContractSchema = createCustomerContractSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const customerContractQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  contractType: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateCustomerContractInput = z.infer<typeof createCustomerContractSchema>;
export type UpdateCustomerContractInput = z.infer<typeof updateCustomerContractSchema>;
export type CustomerContractQueryInput = z.infer<typeof customerContractQuerySchema>;
export type CustomerContractGroupInput = z.infer<typeof customerContractGroupSchema>;

