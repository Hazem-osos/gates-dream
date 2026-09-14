import { z } from 'zod';

export const createCostCenterSchema = z.object({
  code: z.string().trim().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  centerType: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  quantityBudget: z.number().nonnegative().optional().nullable(),
  warning: z.enum(['مدين', 'دائن', 'بدون']).optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateCostCenterSchema = createCostCenterSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const costCenterQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
export type CostCenterQueryInput = z.infer<typeof costCenterQuerySchema>;
