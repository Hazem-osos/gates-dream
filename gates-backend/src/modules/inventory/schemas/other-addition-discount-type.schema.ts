import { z } from 'zod';

export const otherAdditionDiscountPercentageSchema = z.object({
  source: z.enum(['default', 'activities', 'items', 'groups', 'suppliers', 'customers']),
  sourceId: z.string().optional().nullable(),
  sourceName: z.string().optional().nullable(),
  percentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100'),
});

export const createOtherAdditionDiscountTypeSchema = z.object({
  serial: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  accountId: z.string().uuid('Account ID must be a valid UUID').optional().nullable(),
  offsetAccountId: z.string().uuid().optional().nullable(),
  abbreviation: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  base: z.enum(['amount', 'discount-origin']).optional().nullable(),
  type: z.enum(['addition', 'discount']).optional().nullable(),
  percentages: z.array(otherAdditionDiscountPercentageSchema).optional().default([]),
});

export const otherAdditionDiscountTypeQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  type: z.enum(['addition', 'discount']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export const updateOtherAdditionDiscountTypeSchema = createOtherAdditionDiscountTypeSchema.partial();

export type CreateOtherAdditionDiscountTypeInput = z.infer<typeof createOtherAdditionDiscountTypeSchema>;
export type UpdateOtherAdditionDiscountTypeInput = z.infer<typeof updateOtherAdditionDiscountTypeSchema>;

